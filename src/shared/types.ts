export interface InventoryRoot {
  id: string;
  name: string;
  path: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  extension: string;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
}

export interface NoteSearchResult {
  path: string;
  name: string;
  excerpt: string;
}

export interface EntropyApi {
  platform: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
  workspace: {
    open: () => Promise<string | null>;
    create: () => Promise<string | null>;
    remember: (path: string) => Promise<void>;
    getRecent: () => Promise<RecentWorkspace[]>;
    clearRecent: () => Promise<void>;
    removeRecent: (path: string) => Promise<void>;
  };
  session: {
    load: () => Promise<AppSession>;
    save: (session: AppSession) => Promise<void>;
  };
  app: {
    onBeforeQuit: (callback: () => void | Promise<void>) => () => void;
    notifyFlushed: () => void;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  fs: {
    listDir: (dirPath: string) => Promise<FileEntry[]>;
    readText: (filePath: string) => Promise<string>;
    writeText: (filePath: string, content: string) => Promise<void>;
    writeTextSafe: (
      filePath: string,
      content: string,
      expectedMtimeMs: number | null,
    ) => Promise<WriteTextResult>;
    mkdir: (dirPath: string) => Promise<void>;
    rename: (fromPath: string, toPath: string) => Promise<void>;
    remove: (targetPath: string) => Promise<void>;
    exists: (targetPath: string) => Promise<boolean>;
    stat: (targetPath: string) => Promise<FileEntry>;
    folderTree: (rootPath: string, maxDepth?: number) => Promise<TreeNode[]>;
    listMarkdown: (rootPath: string) => Promise<FileEntry[]>;
    searchMarkdown: (rootPath: string, query: string) => Promise<NoteSearchResult[]>;
    findBacklinks: (rootPath: string, notePath: string) => Promise<NoteSearchResult[]>;
    createNote: (dirPath: string, name?: string) => Promise<string>;
    join: (...parts: string[]) => Promise<string>;
    dirname: (filePath: string) => Promise<string>;
    basename: (filePath: string) => Promise<string>;
    relative: (fromPath: string, toPath: string) => Promise<string>;
    toUrl: (filePath: string) => Promise<string>;
    toThumbUrl: (filePath: string) => Promise<string>;
    duplicate: (targetPath: string) => Promise<string>;
    reveal: (targetPath: string) => Promise<void>;
    openExternal: (targetPath: string) => Promise<void>;
    getHomePath: () => Promise<string>;
    getInventoryRoots: (extraPaths?: string[]) => Promise<InventoryRoot[]>;
    listMountRoots: () => Promise<InventoryRoot[]>;
    pickInventoryFolder: () => Promise<string | null>;
    measurePath: (targetPath: string) => Promise<number>;
    measureChildren: (dirPath: string) => Promise<Array<{ path: string; size: number }>>;
  };
  canvas: {
    load: (workspacePath: string) => Promise<CanvasDocument | null>;
    save: (doc: CanvasDocument) => Promise<void>;
  };
}

export type WriteTextResult =
  | { ok: true; mtimeMs: number }
  | { ok: false; reason: "missing" | "conflict"; mtimeMs: number | null };

export interface AppSession {
  lastWorkspace: string | null;
  settings: {
    theme: "dark" | "light";
    filesView: "list" | "grid";
    sidebarCollapsed: boolean;
    contextCollapsed: boolean;
    panelLayout: {
      sidebar: number;
      main: number;
      context: number;
    };
    inventoryPanelLayout?: {
      sidebar: number;
      main: number;
      context: number;
    };
    inventoryExtraRoots?: string[];
  };
}

export interface RecentWorkspace {
  path: string;
  name: string;
  openedAt: number;
}

export interface CanvasDocument {
  version: 1;
  workspacePath: string;
  camera: { x: number; y: number; scale: number };
  objects: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    path: string;
    title: string;
    text?: string;
  }>;
  connections: Array<{
    id: string;
    fromId: string;
    toId: string;
  }>;
}

declare global {
  interface Window {
    entropy: EntropyApi;
  }
}

export {};
