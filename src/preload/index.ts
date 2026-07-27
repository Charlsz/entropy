import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("entropy", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
