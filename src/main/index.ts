import "./silenceDeprecations";
import { app, BrowserWindow, ipcMain, nativeImage, protocol, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import * as filesystem from "./fs";
import * as inventory from "./inventory";
import { undoRemoves, finalizeTrash, finalizeOrphanedStaging } from "./trash";
import { findExactDuplicates } from "./duplicates";
import type { DuplicateScanProgress } from "./duplicates";
import {
  DEFAULT_DUPLICATE_SCAN_SCOPE,
  DUPLICATE_SCAN_SCOPES,
  type DuplicateScanScopeId,
} from "../shared/duplicateScopes";
import { FILE_PROTOCOL, registerFileProtocol, toEntropyThumbUrl, toEntropyUrl } from "./protocol";
import { loadSession, saveSession, type AppSession } from "./session";
import { unwatchAll, unwatchDir, watchDir } from "./folderWatch";
import {
  clearRecentWorkspaces,
  createWorkspaceDialog,
  getRecentWorkspaces,
  isEntropyWorkspace,
  listMarkedWorkspaces,
  openWorkspaceDialog,
  rememberWorkspace,
  removeRecentWorkspace,
} from "./workspaces";

const isDev = process.env.ENTROPY_DEV === "1";
let allowQuit = false;
let mainWindow: BrowserWindow | null = null;
const duplicateAbortBySender = new Map<number, AbortController>();

protocol.registerSchemesAsPrivileged([
  {
    scheme: FILE_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

function isAppNavigation(url: string): boolean {
  if (isDev) return url.startsWith("http://localhost:5173");
  return /[/\\]renderer[/\\]index\.html(?:[?#]|$)/i.test(url);
}

function attachShellGuards(win: BrowserWindow): void {
  win.webContents.on("will-navigate", (event, url) => {
    if (isAppNavigation(url)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) {
      void shell.openExternal(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

function appIconPath(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath, "Entropy.png"),
    path.join(__dirname, "../../Entropy.png"),
    path.join(process.cwd(), "Entropy.png"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function chromeColors(theme: "light" | "dark"): {
  backgroundColor: string;
  overlayColor: string;
  symbolColor: string;
} {
  const light = theme === "light";
  return {
    backgroundColor: light ? "#fafaf9" : "#131413",
    overlayColor: light ? "#fafaf9" : "#131413",
    symbolColor: light ? "#131413" : "#fafaf9",
  };
}

async function createWindow(): Promise<BrowserWindow> {
  const icon = appIconPath();
  // Match session theme before first paint so Win/Linux overlays aren't briefly paper-white.
  const session = await loadSession().catch(() => null);
  const chrome = chromeColors(session?.settings.theme === "light" ? "light" : "dark");
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 520,
    // Keep visible — ready-to-show is unreliable with hidden title bars on Windows.
    // Theme-matched backgroundColor still prevents the white flash.
    show: true,
    backgroundColor: chrome.backgroundColor,
    ...(icon ? { icon } : {}),
    // Frameless chrome — Win/Linux use custom window controls in the renderer.
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 14, y: 14 } }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      plugins: true,
    },
  });

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  attachShellGuards(win);

  win.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame) return;
    console.error("Failed to load window:", { code, description, url });
    if (!isAppNavigation(url)) {
      if (isDev) void win.loadURL("http://localhost:5173");
      else void win.loadFile(path.join(__dirname, "../renderer/index.html"));
    }
  });

  if (isDev) {
    void win.loadURL("http://localhost:5173");
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

function registerIpc(): void {
  ipcMain.handle("workspace:open", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return openWorkspaceDialog(win);
  });

  ipcMain.handle("workspace:create", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return createWorkspaceDialog(win);
  });

  ipcMain.handle("workspace:getRecent", async () => getRecentWorkspaces());
  ipcMain.handle("workspace:listMarked", async () => listMarkedWorkspaces());
  ipcMain.handle("workspace:isMarked", async (_event, workspacePath: string) =>
    isEntropyWorkspace(workspacePath),
  );
  ipcMain.handle("workspace:clearRecent", async () => clearRecentWorkspaces());
  ipcMain.handle("workspace:removeRecent", async (_event, workspacePath: string) => {
    await removeRecentWorkspace(workspacePath);
  });
  ipcMain.handle("workspace:remember", async (_event, workspacePath: string) => {
    await rememberWorkspace(workspacePath);
  });

  ipcMain.handle("session:load", async () => loadSession());
  ipcMain.handle("session:save", async (_event, session: AppSession) => saveSession(session));

  ipcMain.handle("fs:listDir", (_event, dirPath: string) => filesystem.listDir(dirPath));
  ipcMain.handle("fs:readText", (_event, filePath: string) => filesystem.readText(filePath));
  ipcMain.handle("fs:writeText", (_event, filePath: string, content: string) =>
    filesystem.writeText(filePath, content),
  );
  ipcMain.handle(
    "fs:writeTextSafe",
    (_event, filePath: string, content: string, expectedMtimeMs: number | null) =>
      filesystem.writeTextIfUnchanged(filePath, content, expectedMtimeMs),
  );
  ipcMain.handle("fs:mkdir", (_event, dirPath: string) => filesystem.mkdir(dirPath));
  ipcMain.handle("fs:rename", (_event, fromPath: string, toPath: string) =>
    filesystem.rename(fromPath, toPath),
  );
  ipcMain.handle("fs:remove", (event, targetPath: string) =>
    filesystem.remove(targetPath, event.sender),
  );
  ipcMain.handle("fs:undoRemove", (_event, paths: string[]) => undoRemoves(paths));
  ipcMain.handle("fs:finalizeTrash", (_event, paths?: string[]) => finalizeTrash(paths));
  ipcMain.handle("fs:exists", (_event, targetPath: string) => filesystem.exists(targetPath));
  ipcMain.handle("fs:stat", (_event, targetPath: string) => filesystem.stat(targetPath));
  ipcMain.handle("fs:folderTree", (_event, rootPath: string, maxDepth?: number) =>
    filesystem.folderTree(rootPath, maxDepth),
  );
  ipcMain.handle("fs:listMarkdown", (_event, rootPath: string) =>
    filesystem.listMarkdown(rootPath),
  );
  ipcMain.handle("fs:searchMarkdown", (_event, rootPath: string, query: string) =>
    filesystem.searchMarkdown(rootPath, query),
  );
  ipcMain.handle("fs:searchInventoryNames", (_event, rootPath: string, query: string) =>
    inventory.searchInventoryNames(rootPath, query),
  );
  ipcMain.handle("fs:findBacklinks", (_event, rootPath: string, notePath: string) =>
    filesystem.findBacklinks(rootPath, notePath),
  );
  ipcMain.handle("fs:findFileReferences", (_event, workspacePath: string, filePath: string) =>
    filesystem.findFileReferences(workspacePath, filePath),
  );
  ipcMain.handle("fs:findDuplicates", (_event, rootPath: string, filePath: string) =>
    filesystem.findDuplicates(rootPath, filePath),
  );
  ipcMain.handle("fs:createNote", (_event, dirPath: string, name?: string) =>
    filesystem.createNote(dirPath, name),
  );
  ipcMain.handle("fs:join", (_event, ...parts: string[]) => filesystem.joinPath(...parts));
  ipcMain.handle("fs:dirname", (_event, filePath: string) => filesystem.dirnamePath(filePath));
  ipcMain.handle("fs:basename", (_event, filePath: string) => filesystem.basenamePath(filePath));
  ipcMain.handle("fs:relative", (_event, fromPath: string, toPath: string) =>
    filesystem.relativePath(fromPath, toPath),
  );
  ipcMain.handle("fs:toUrl", (_event, filePath: string) => toEntropyUrl(filePath));
  ipcMain.handle("fs:toThumbUrl", (_event, filePath: string) => toEntropyThumbUrl(filePath));
  ipcMain.handle(
    "fs:resolveEmbedTarget",
    (_event, target: string, notePath: string, workspacePath?: string | null) =>
      filesystem.resolveEmbedTarget(target, notePath, workspacePath),
  );
  ipcMain.handle("fs:duplicate", (_event, targetPath: string) => filesystem.duplicate(targetPath));
  ipcMain.handle("fs:reveal", (_event, targetPath: string) =>
    filesystem.revealInFolder(targetPath),
  );
  ipcMain.handle("fs:openTrash", () => filesystem.openOsTrash());
  ipcMain.handle("fs:openExternal", (_event, targetPath: string) =>
    filesystem.openExternal(targetPath),
  );
  ipcMain.handle("fs:getHomePath", () => inventory.getHomePath());
  ipcMain.handle("fs:getDiskSpace", (_event, targetPath?: string) =>
    inventory.getDiskSpace(targetPath),
  );
  ipcMain.handle("fs:getInventoryRoots", (_event, extraPaths?: string[]) =>
    inventory.getInventoryRoots(extraPaths ?? []),
  );
  ipcMain.handle("fs:listMountRoots", () => inventory.listMountRoots());
  ipcMain.handle("fs:pickInventoryFolder", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return inventory.pickInventoryFolder(win);
  });
  ipcMain.handle("fs:pickFile", (event, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return inventory.pickFile(win, defaultPath);
  });
  ipcMain.handle("fs:measurePath", (_event, targetPath: string) =>
    inventory.measurePath(targetPath),
  );
  ipcMain.handle("fs:measureChildren", (_event, dirPath: string) =>
    inventory.measureChildren(dirPath),
  );
  ipcMain.handle("fs:scanTreemapFiles", (_event, dirPath: string, maxLeaves?: number) =>
    inventory.scanTreemapFiles(dirPath, maxLeaves),
  );
  ipcMain.handle("fs:scanTreemapLevel", (_event, dirPath: string) =>
    inventory.scanTreemapLevel(dirPath),
  );
  ipcMain.handle(
    "fs:scanLargeFilesApprox",
    (_event, rootPaths: string[], minBytes?: number) =>
      inventory.scanLargeFilesApprox(rootPaths, minBytes),
  );
  ipcMain.handle(
    "fs:scanLargeFiles",
    (_event, rootPaths: string[], minBytes?: number) =>
      inventory.scanLargeFiles(rootPaths, minBytes),
  );
  ipcMain.handle("fs:canOsPreview", async (_event, targetPath: string) => {
    const normalized = path.normalize(targetPath);
    const ext = path.extname(normalized).toLowerCase();
    const imageExt = new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".bmp",
      ".svg",
      ".ico",
      ".tif",
      ".tiff",
      ".avif",
    ]);
    const osThumbExt = new Set([
      ".pdf",
      ".mp4",
      ".m4v",
      ".mov",
      ".webm",
      ".mkv",
      ".avi",
      ".wmv",
    ]);
    if (imageExt.has(ext) && ext !== ".svg" && ext !== ".gif") {
      try {
        const image = nativeImage.createFromPath(normalized);
        if (!image.isEmpty()) return true;
      } catch {
        // Fall through to OS thumbnail.
      }
    }
    if (imageExt.has(ext) || osThumbExt.has(ext)) {
      try {
        const thumb = await nativeImage.createThumbnailFromPath(normalized, {
          width: 96,
          height: 96,
        });
        return !thumb.isEmpty();
      } catch {
        return imageExt.has(ext);
      }
    }
    return false;
  });
  ipcMain.handle(
    "fs:watchDir",
    (event, dirPath: string, options?: { recursive?: boolean }) => {
      watchDir(event.sender, dirPath, options);
    },
  );
  ipcMain.handle("fs:unwatchDir", (event, dirPath: string) => {
    unwatchDir(event.sender, dirPath);
  });
  ipcMain.handle("fs:unwatchAll", (event) => {
    unwatchAll(event.sender);
  });

  ipcMain.handle("duplicates:scan", async (event, rootPath: string, scope?: string) => {
    const senderId = event.sender.id;
    duplicateAbortBySender.get(senderId)?.abort();
    const controller = new AbortController();
    duplicateAbortBySender.set(senderId, controller);

    const resolvedScope: DuplicateScanScopeId = DUPLICATE_SCAN_SCOPES.some((item) => item.id === scope)
      ? (scope as DuplicateScanScopeId)
      : DEFAULT_DUPLICATE_SCAN_SCOPE;

    try {
      return await findExactDuplicates(rootPath, {
        signal: controller.signal,
        scope: resolvedScope,
        onProgress: (progress: DuplicateScanProgress) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("duplicates:progress", progress);
          }
        },
      });
    } finally {
      if (duplicateAbortBySender.get(senderId) === controller) {
        duplicateAbortBySender.delete(senderId);
      }
    }
  });

  ipcMain.handle("duplicates:cancel", (event) => {
    duplicateAbortBySender.get(event.sender.id)?.abort();
  });

  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle("window:maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle("window:isMaximized", (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });
  ipcMain.handle("window:setChromeTheme", () => {
    // Custom renderer controls — no native title-bar overlay to recolor.
  });

  ipcMain.on("app:flushed", () => {
    allowQuit = true;
    app.quit();
  });
}

app.whenReady().then(() => {
  registerFileProtocol();
  registerIpc();
  void finalizeOrphanedStaging();
  void createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("before-quit", (event) => {
  void finalizeTrash();
  if (allowQuit) return;
  const win =
    mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) {
    allowQuit = true;
    return;
  }
  event.preventDefault();
  win.webContents.send("app:before-quit");
  setTimeout(() => {
    if (!allowQuit) {
      allowQuit = true;
      app.quit();
    }
  }, 2500);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
