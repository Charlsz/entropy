import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { WORKSPACE_PICK_CHANNEL } from '../shared/ipc';
import { deriveWorkspaceName, type WorkspaceAction, type WorkspaceSelection } from '../shared/workspace';

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

ipcMain.handle(WORKSPACE_PICK_CHANNEL, async (_event, action: WorkspaceAction): Promise<WorkspaceSelection | null> => {
  const result = dialog.showOpenDialogSync({
    title: action === 'create' ? 'Create Workspace' : 'Open Workspace',
    defaultPath: app.getPath('documents'),
    properties: action === 'create' ? ['openDirectory', 'createDirectory', 'dontAddToRecent'] : ['openDirectory', 'dontAddToRecent']
  });

  if (!result || result.length === 0) {
    return null;
  }

  const workspacePath = result[0];
  if (!workspacePath) {
    return null;
  }

  return {
    path: workspacePath,
    name: deriveWorkspaceName(workspacePath)
  };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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