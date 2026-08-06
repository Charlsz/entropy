export interface InventoryRoot {
  id: string;
  name: string;
  path: string;
}

export type { FileKindId } from "./fileKinds";

export interface TreemapFileLeaf {
  path: string;
  name: string;
  size: number;
  extension: string;
  kind: import("./fileKinds").FileKindId;
  isDirectory?: boolean;
  /** Parent folder name for hover intel. */
  location?: string;
  modifiedAt?: number;
}

export interface TreemapScanResult {
  files: TreemapFileLeaf[];
  totalSize: number;
  fileCount: number;
  truncated: boolean;
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

export interface GlobalSearchHit {
  path: string;
  name: string;
  excerpt: string;
  source: "note" | "file" | "folder";
  /** When source is note and the hit is outside the current workspace. */
  workspacePath?: string;
  workspaceName?: string;
}

export interface DiskSpaceInfo {
  free: number;
  total: number;
}

export interface LargeFilesApproxResult {
  totalBytes: number;
  count: number;
  truncated: boolean;
}

export interface LargeFileHit {
  path: string;
  name: string;
  size: number;
  modifiedAt: number;
  extension: string;
}

export interface LargeFilesScanResult extends LargeFilesApproxResult {
  files: LargeFileHit[];
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  copies: FileEntry[];
  /** Bytes reclaimable if all but one copy are removed. */
  recoverableBytes: number;
  /** Suggested path to keep (most recently modified). */
  keepPath: string;
}

export type DuplicateScanPhase =
  | "scanning"
  | "size"
  | "partial"
  | "full"
  | "verify"
  | "done"
  | "cancelled"
  | "error";

export interface DuplicateScanProgress {
  phase: DuplicateScanPhase;
  progress: number;
  message: string;
  filesSeen: number;
  candidateFiles: number;
  groupsFound: number;
  errors: number;
  /** Estimated remaining time in ms once throughput is known; null while warming up. */
  etaMs?: number | null;
  /** Human-readable activity line for the live log. */
  logLine?: string;
  /** Newest duplicate group discovered during the scan (streamed). */
  latestGroup?: DuplicateGroup | null;
}

export interface DuplicateScanResult {
  groups: DuplicateGroup[];
  errors: Array<{ path: string; error: string }>;
  filesScanned: number;
  durationMs: number;
}

import type { DuplicateScanScopeId } from "./duplicateScopes";

export type { DuplicateScanScopeId } from "./duplicateScopes";

export interface DuplicateScanOptions {
  scope?: DuplicateScanScopeId;
}

export interface EntropyApi {
  platform: "darwin" | "win32" | "linux" | string;
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
    listMarked: () => Promise<RecentWorkspace[]>;
    isMarked: (path: string) => Promise<boolean>;
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
    /** False when the OS draws min/max/close (Win/Linux overlay or macOS traffic lights). */
    /** Update native title-bar overlay colors when the theme changes (Win/Linux). */
    setChromeTheme: (theme: "light" | "dark") => Promise<void>;
    needsCustomControls: boolean;
  };
  duplicates: {
    scan: (rootPath: string, options?: DuplicateScanOptions) => Promise<DuplicateScanResult>;
    cancel: () => Promise<void>;
    onProgress: (callback: (progress: DuplicateScanProgress) => void) => () => void;
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
    undoRemove: (paths: string[]) => Promise<{ restored: number; failed: string[] }>;
    /** Move staged undo deletes into the real OS Recycle Bin / Trash (no OS UI). */
    finalizeTrash: (paths?: string[]) => Promise<void>;
    exists: (targetPath: string) => Promise<boolean>;
    stat: (targetPath: string) => Promise<FileEntry>;
    folderTree: (rootPath: string, maxDepth?: number) => Promise<TreeNode[]>;
    listMarkdown: (rootPath: string) => Promise<FileEntry[]>;
    searchMarkdown: (rootPath: string, query: string) => Promise<NoteSearchResult[]>;
    searchInventoryNames: (rootPath: string, query: string) => Promise<GlobalSearchHit[]>;
    findBacklinks: (rootPath: string, notePath: string) => Promise<NoteSearchResult[]>;
    createNote: (dirPath: string, name?: string) => Promise<string>;
    join: (...parts: string[]) => Promise<string>;
    dirname: (filePath: string) => Promise<string>;
    basename: (filePath: string) => Promise<string>;
    relative: (fromPath: string, toPath: string) => Promise<string>;
    toUrl: (filePath: string) => Promise<string>;
    toThumbUrl: (filePath: string) => Promise<string>;
    /** Resolve `![[target]]` / image href: absolute, note-relative, workspace, then basename search. */
    resolveEmbedTarget: (
      target: string,
      notePath: string,
      workspacePath?: string | null,
    ) => Promise<string | null>;
    duplicate: (targetPath: string) => Promise<string>;
    reveal: (targetPath: string) => Promise<void>;
    openExternal: (targetPath: string) => Promise<void>;
    getHomePath: () => Promise<string>;
    getDiskSpace: (targetPath?: string) => Promise<DiskSpaceInfo>;
    getInventoryRoots: (extraPaths?: string[]) => Promise<InventoryRoot[]>;
    listMountRoots: () => Promise<InventoryRoot[]>;
    pickInventoryFolder: () => Promise<string | null>;
    pickFile: (defaultPath?: string) => Promise<string | null>;
    measurePath: (targetPath: string) => Promise<number>;
    measureChildren: (dirPath: string) => Promise<Array<{ path: string; size: number }>>;
    scanTreemapFiles: (dirPath: string, maxLeaves?: number) => Promise<TreemapScanResult>;
    scanTreemapLevel: (dirPath: string) => Promise<TreemapScanResult>;
    scanLargeFilesApprox: (
      rootPaths: string[],
      minBytes?: number,
    ) => Promise<LargeFilesApproxResult>;
    scanLargeFiles: (
      rootPaths: string[],
      minBytes?: number,
    ) => Promise<LargeFilesScanResult>;
    /** True when the OS can produce a thumbnail/preview face for this path. */
    canOsPreview: (targetPath: string) => Promise<boolean>;
    findFileReferences: (workspacePath: string, filePath: string) => Promise<NoteSearchResult[]>;
    findDuplicates: (rootPath: string, filePath: string) => Promise<FileEntry[]>;
    /** Watch a folder for external create/rename/delete/write; pairs with onDirChanged. */
    watchDir: (dirPath: string, options?: { recursive?: boolean }) => Promise<void>;
    unwatchDir: (dirPath: string) => Promise<void>;
    unwatchAll: () => Promise<void>;
    onDirChanged: (callback: (info: { path: string }) => void) => () => void;
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
    inventoryTreemapCollapsed?: boolean;
    libraryPerspective?: "folders" | "gallery" | "large-files" | "duplicates";
    intelligenceView?: "relationships" | "copilot" | null;
    uiDensity?: "comfortable" | "default" | "compact";
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
    largeFilesApproxBytes?: number | null;
  };
}

export interface RecentWorkspace {
  path: string;
  name: string;
  openedAt: number;
}

declare global {
  interface Window {
    entropy: EntropyApi;
  }
}

export {};
