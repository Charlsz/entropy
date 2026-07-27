import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
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

  ipcMain.handle("workspace:clearRecent", async () => {
    await clearRecentWorkspaces();
  });

  ipcMain.handle("workspace:removeRecent", async (_event, workspacePath: string) => {
    await removeRecentWorkspace(workspacePath);
  });

  ipcMain.handle("workspace:remember", async (_event, workspacePath: string) => {
    await rememberWorkspace(workspacePath);
  });
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
