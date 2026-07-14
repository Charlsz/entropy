import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { registerWorkspaceIpc } from './ipc/workspace';

let mainWindow: BrowserWindow | null = null;

function getRendererUrl(): string | null {
  return process.env.VITE_DEV_SERVER_URL ?? null;
}

function getRendererFilePath(): string {
  return path.join(app.getAppPath(), 'dist', 'index.html');
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1160,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Entropy',
    backgroundColor: '#212121',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const rendererUrl = getRendererUrl();
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(getRendererFilePath());
  }

  window.once('ready-to-show', () => {
    window.show();
  });

  mainWindow = window;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerWorkspaceIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
