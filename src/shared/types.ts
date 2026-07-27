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
  fs: {
    listDir: (dirPath: string) => Promise<FileEntry[]>;
    readText: (filePath: string) => Promise<string>;
    writeText: (filePath: string, content: string) => Promise<void>;
    mkdir: (dirPath: string) => Promise<void>;
    rename: (fromPath: string, toPath: string) => Promise<void>;
    remove: (targetPath: string) => Promise<void>;
    exists: (targetPath: string) => Promise<boolean>;
    stat: (targetPath: string) => Promise<FileEntry>;
    folderTree: (rootPath: string, maxDepth?: number) => Promise<TreeNode[]>;
    listMarkdown: (rootPath: string) => Promise<FileEntry[]>;
    searchMarkdown: (rootPath: string, query: string) => Promise<NoteSearchResult[]>;
    createNote: (dirPath: string, name?: string) => Promise<string>;
    join: (...parts: string[]) => Promise<string>;
    dirname: (filePath: string) => Promise<string>;
    basename: (filePath: string) => Promise<string>;
    relative: (fromPath: string, toPath: string) => Promise<string>;
    toUrl: (filePath: string) => Promise<string>;
    duplicate: (targetPath: string) => Promise<string>;
    reveal: (targetPath: string) => Promise<void>;
    openExternal: (targetPath: string) => Promise<void>;
  };
  canvas: {
    load: (workspacePath: string) => Promise<CanvasDocument | null>;
    save: (doc: CanvasDocument) => Promise<void>;
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
