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
  session: {
    load: () => ipcRenderer.invoke("session:load"),
    save: (session) => ipcRenderer.invoke("session:save", session),
  },
  app: {
    onBeforeQuit: (callback) => {
      const listener = () => {
        void Promise.resolve(callback()).finally(() => {
          ipcRenderer.send("app:flushed");
        });
      };
      ipcRenderer.on("app:before-quit", listener);
      return () => {
        ipcRenderer.removeListener("app:before-quit", listener);
      };
    },
    notifyFlushed: () => ipcRenderer.send("app:flushed"),
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  },
  duplicates: {
    openWindow: (rootPath) => ipcRenderer.invoke("duplicates:openWindow", rootPath),
    scan: (rootPath, options) =>
      ipcRenderer.invoke("duplicates:scan", rootPath, options?.scope),
    cancel: () => ipcRenderer.invoke("duplicates:cancel"),
    onProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: import("../shared/types").DuplicateScanProgress) => {
        callback(progress);
      };
      ipcRenderer.on("duplicates:progress", listener);
      return () => {
        ipcRenderer.removeListener("duplicates:progress", listener);
      };
    },
  },
  fs: {
    listDir: (dirPath) => ipcRenderer.invoke("fs:listDir", dirPath),
    readText: (filePath) => ipcRenderer.invoke("fs:readText", filePath),
    writeText: (filePath, content) => ipcRenderer.invoke("fs:writeText", filePath, content),
    writeTextSafe: (filePath, content, expectedMtimeMs) =>
      ipcRenderer.invoke("fs:writeTextSafe", filePath, content, expectedMtimeMs),
    mkdir: (dirPath) => ipcRenderer.invoke("fs:mkdir", dirPath),
    rename: (fromPath, toPath) => ipcRenderer.invoke("fs:rename", fromPath, toPath),
    remove: (targetPath) => ipcRenderer.invoke("fs:remove", targetPath),
    exists: (targetPath) => ipcRenderer.invoke("fs:exists", targetPath),
    stat: (targetPath) => ipcRenderer.invoke("fs:stat", targetPath),
    folderTree: (rootPath, maxDepth) => ipcRenderer.invoke("fs:folderTree", rootPath, maxDepth),
    listMarkdown: (rootPath) => ipcRenderer.invoke("fs:listMarkdown", rootPath),
    searchMarkdown: (rootPath, query) =>
      ipcRenderer.invoke("fs:searchMarkdown", rootPath, query),
    searchInventoryNames: (rootPath, query) =>
      ipcRenderer.invoke("fs:searchInventoryNames", rootPath, query),
    findBacklinks: (rootPath, notePath) =>
      ipcRenderer.invoke("fs:findBacklinks", rootPath, notePath),
    findFileReferences: (workspacePath, filePath) =>
      ipcRenderer.invoke("fs:findFileReferences", workspacePath, filePath),
    findDuplicates: (rootPath, filePath) =>
      ipcRenderer.invoke("fs:findDuplicates", rootPath, filePath),
    findDuplicateGroups: (rootPath) => ipcRenderer.invoke("fs:findDuplicateGroups", rootPath),
    createNote: (dirPath, name) => ipcRenderer.invoke("fs:createNote", dirPath, name),
    join: (...parts) => ipcRenderer.invoke("fs:join", ...parts),
    dirname: (filePath) => ipcRenderer.invoke("fs:dirname", filePath),
    basename: (filePath) => ipcRenderer.invoke("fs:basename", filePath),
    relative: (fromPath, toPath) => ipcRenderer.invoke("fs:relative", fromPath, toPath),
    toUrl: (filePath) => ipcRenderer.invoke("fs:toUrl", filePath),
    toThumbUrl: (filePath) => ipcRenderer.invoke("fs:toThumbUrl", filePath),
    duplicate: (targetPath) => ipcRenderer.invoke("fs:duplicate", targetPath),
    reveal: (targetPath) => ipcRenderer.invoke("fs:reveal", targetPath),
    openExternal: (targetPath) => ipcRenderer.invoke("fs:openExternal", targetPath),
    getHomePath: () => ipcRenderer.invoke("fs:getHomePath"),
    getInventoryRoots: (extraPaths) => ipcRenderer.invoke("fs:getInventoryRoots", extraPaths),
    listMountRoots: () => ipcRenderer.invoke("fs:listMountRoots"),
    pickInventoryFolder: () => ipcRenderer.invoke("fs:pickInventoryFolder"),
    measurePath: (targetPath) => ipcRenderer.invoke("fs:measurePath", targetPath),
    measureChildren: (dirPath) => ipcRenderer.invoke("fs:measureChildren", dirPath),
    scanTreemapFiles: (dirPath, maxLeaves) =>
      ipcRenderer.invoke("fs:scanTreemapFiles", dirPath, maxLeaves),
    scanTreemapLevel: (dirPath) => ipcRenderer.invoke("fs:scanTreemapLevel", dirPath),
  },
  canvas: {
    load: (workspacePath) => ipcRenderer.invoke("canvas:load", workspacePath),
    save: (doc) => ipcRenderer.invoke("canvas:save", doc),
  },
};

contextBridge.exposeInMainWorld("entropy", api);
