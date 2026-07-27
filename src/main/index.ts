import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import * as filesystem from "./fs";
import {
  clearRecentWorkspaces,
  createWorkspaceDialog,
  getRecentWorkspaces,
  openWorkspaceDialog,
  rememberWorkspace,
  removeRecentWorkspace,
} from "./workspaces";

const isDev = !app.isPackaged;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 520,
    show: false,
    backgroundColor: "#111111",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    titleBarOverlay:
      process.platform === "win32"
        ? { color: "#141414", symbolColor: "#eaeaea", height: 40 }
        : undefined,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
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
  ipcMain.handle("workspace:clearRecent", async () => clearRecentWorkspaces());
  ipcMain.handle("workspace:removeRecent", async (_event, workspacePath: string) => {
    await removeRecentWorkspace(workspacePath);
  });
  ipcMain.handle("workspace:remember", async (_event, workspacePath: string) => {
    await rememberWorkspace(workspacePath);
  });

  ipcMain.handle("fs:listDir", (_event, dirPath: string) => filesystem.listDir(dirPath));
  ipcMain.handle("fs:readText", (_event, filePath: string) => filesystem.readText(filePath));
  ipcMain.handle("fs:writeText", (_event, filePath: string, content: string) =>
    filesystem.writeText(filePath, content),
  );
  ipcMain.handle("fs:mkdir", (_event, dirPath: string) => filesystem.mkdir(dirPath));
  ipcMain.handle("fs:rename", (_event, fromPath: string, toPath: string) =>
    filesystem.rename(fromPath, toPath),
  );
  ipcMain.handle("fs:remove", (_event, targetPath: string) => filesystem.remove(targetPath));
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
  ipcMain.handle("fs:createNote", (_event, dirPath: string, name?: string) =>
    filesystem.createNote(dirPath, name),
  );
  ipcMain.handle("fs:join", (_event, ...parts: string[]) => filesystem.joinPath(...parts));
  ipcMain.handle("fs:dirname", (_event, filePath: string) => filesystem.dirnamePath(filePath));
  ipcMain.handle("fs:basename", (_event, filePath: string) => filesystem.basenamePath(filePath));
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
