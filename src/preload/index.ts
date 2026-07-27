import { contextBridge, ipcRenderer } from "electron";
import type { EntropyApi } from "../shared/types";

const api: EntropyApi = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  workspace: {
    open: () => ipcRenderer.invoke("workspace:open"),
    create: () => ipcRenderer.invoke("workspace:create"),
    remember: (workspacePath: string) => ipcRenderer.invoke("workspace:remember", workspacePath),
    getRecent: () => ipcRenderer.invoke("workspace:getRecent"),
    clearRecent: () => ipcRenderer.invoke("workspace:clearRecent"),
    removeRecent: (workspacePath: string) =>
      ipcRenderer.invoke("workspace:removeRecent", workspacePath),
  },
};

contextBridge.exposeInMainWorld("entropy", api);
