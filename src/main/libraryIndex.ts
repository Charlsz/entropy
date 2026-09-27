import { app, BrowserWindow, type WebContents } from "electron";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileEntry, GlobalSearchHit } from "../shared/types";
import { indexCoversChange, libraryIndexNeedsBuild } from "../shared/libraryIndexPlan";
import { isProtectedOsDirName, isProtectedOsPath } from "../shared/protectedPaths";
import {
  recentSnapshot,
  searchSnapshot,
  type LibraryIndexEntry,
  type LibraryIndexSnapshot,
} from "../shared/libraryIndexQuery";

export type { LibraryIndexEntry, LibraryIndexSnapshot };
export { recentSnapshot, searchSnapshot };

const MAX_DEPTH = 16;
const MAX_VISITS = 120_000;
const MAX_ENTRIES = 80_000;
const REBUILD_DEBOUNCE_MS = 1500;
const REBUILD_RETRY_MS = 8_000;

interface RootIndex {
  rootPath: string;
  snapshot: LibraryIndexSnapshot | null;
  stale: boolean;
  building: boolean;
  abort: AbortController | null;
  retryAfter: number | null;
  buildPromise: Promise<LibraryIndexSnapshot | null> | null;
}

const indexes = new Map<string, RootIndex>();
const rebuildTimers = new Map<string, ReturnType<typeof setTimeout>>();

function rootKey(rootPath: string): string {
  return path.normalize(rootPath).replace(/[/\\]+$/, "").toLowerCase();
}

function stateFor(rootPath: string): RootIndex {
  const key = rootKey(rootPath);
  let state = indexes.get(key);
  if (!state) {
    state = {
      rootPath,
      snapshot: null,
      stale: false,
      building: false,
      abort: null,
      retryAfter: null,
      buildPromise: null,
    };
    indexes.set(key, state);
  }
  return state;
}

function cacheFile(rootPath: string): string {
  const hash = createHash("sha1").update(rootKey(rootPath)).digest("hex");
  return path.join(app.getPath("userData"), "library-indexes", `${hash}.json`);
}

async function readDisk(rootPath: string): Promise<LibraryIndexSnapshot | null> {
  try {
    const raw = await fs.readFile(cacheFile(rootPath), "utf8");
    const parsed = JSON.parse(raw) as LibraryIndexSnapshot;
    if (!parsed || !Array.isArray(parsed.entries) || typeof parsed.root !== "string") return null;
    if (rootKey(parsed.root) !== rootKey(rootPath)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeDisk(snapshot: LibraryIndexSnapshot): Promise<void> {
  const filePath = cacheFile(snapshot.root);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(snapshot), "utf8");
  await fs.rename(tempPath, filePath).catch(async () => {
    await fs.copyFile(tempPath, filePath);
    await fs.unlink(tempPath).catch(() => undefined);
  });
}

function publishLibraryIndex(rootPath: string, sender?: WebContents): void {
  const payload = { root: path.normalize(rootPath) };
  const sent = new Set<number>();
  for (const win of BrowserWindow.getAllWindows()) {
    const contents = win.webContents;
    if (contents.isDestroyed()) continue;
    contents.send("library:updated", payload);
    sent.add(contents.id);
  }
  if (sender && !sender.isDestroyed() && !sent.has(sender.id)) {
    sender.send("library:updated", payload);
  }
}

function scheduleRebuild(rootPath: string): void {
  const key = rootKey(rootPath);
  const existing = rebuildTimers.get(key);
  if (existing) clearTimeout(existing);
  rebuildTimers.set(
    key,
    setTimeout(() => {
      rebuildTimers.delete(key);
      void ensureLibraryIndex(rootPath, undefined, { force: true }).catch(() => undefined);
    }, REBUILD_DEBOUNCE_MS),
  );
}

function markStale(state: RootIndex): void {
  state.stale = true;
  state.abort?.abort();
  scheduleRebuild(state.rootPath);
}

/** Mark one root stale and rebuild it. Used by the explicit invalidate IPC. */
export function invalidateLibraryIndex(rootPath: string): void {
  if (!rootPath.trim()) return;
  markStale(stateFor(rootPath));
}

/**
 * Refresh any index that already covers this path.
 * Does not start an index for a root the user has not opened.
 */
export function noteFilesystemChanged(changedPath: string): void {
  if (!changedPath.trim()) return;
  const changed = rootKey(changedPath);
  for (const state of indexes.values()) {
    if (!indexCoversChange(rootKey(state.rootPath), changed)) continue;
    markStale(state);
  }
}

async function walkRoot(rootPath: string, signal: AbortSignal): Promise<LibraryIndexSnapshot> {
  const entries: LibraryIndexEntry[] = [];
  let visited = 0;
  let truncated = false;
  const platform = process.platform;
  const root = path.normalize(rootPath);

  async function walk(dirPath: string, depth: number): Promise<void> {
    if (signal.aborted || truncated || depth > MAX_DEPTH) return;
    if (isProtectedOsPath(dirPath, platform)) return;

    let dirents;
    try {
      dirents = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const dirent of dirents) {
      if (signal.aborted || truncated) return;
      if (dirent.name === "." || dirent.name === "..") continue;
      if (isProtectedOsDirName(dirent.name, platform)) continue;

      const fullPath = path.join(dirPath, dirent.name);
      visited += 1;
      if (visited > MAX_VISITS || entries.length >= MAX_ENTRIES) {
        truncated = true;
        return;
      }
      if (visited % 250 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      try {
        const info = await fs.lstat(fullPath);
        if (info.isSymbolicLink()) continue;
        if (isProtectedOsPath(fullPath, platform)) continue;
        const isDirectory = info.isDirectory();
        entries.push({
          path: fullPath,
          name: dirent.name,
          isDirectory,
          size: isDirectory ? 0 : info.size,
          modifiedAt: info.mtimeMs,
          extension: isDirectory ? "" : path.extname(dirent.name).toLowerCase(),
        });
        if (isDirectory) await walk(fullPath, depth + 1);
      } catch {
        // Skip unreadable entries.
      }
    }
  }

  if (!isProtectedOsPath(root, platform)) await walk(root, 0);

  return {
    root,
    builtAt: Date.now(),
    truncated,
    entries,
  };
}

export async function ensureLibraryIndex(
  rootPath: string,
  sender?: WebContents,
  options?: { force?: boolean },
): Promise<LibraryIndexSnapshot | null> {
  if (!rootPath.trim()) return null;
  const state = stateFor(rootPath);
  const force = Boolean(options?.force);

  if (!force && state.buildPromise) return state.buildPromise;
  if (
    !force &&
    !libraryIndexNeedsBuild({
      hasSnapshot: Boolean(state.snapshot),
      stale: state.stale,
      building: false,
      retryAfter: state.retryAfter,
    })
  ) {
    return state.snapshot;
  }

  state.abort?.abort();
  const abort = new AbortController();
  state.abort = abort;
  state.building = true;

  const holder: { promise: Promise<LibraryIndexSnapshot | null> | null } = { promise: null };
  holder.promise = (async (): Promise<LibraryIndexSnapshot | null> => {
    try {
      if (!force && !state.stale) {
        const disk = await readDisk(rootPath);
        if (abort.signal.aborted || state.abort !== abort) return state.snapshot;
        if (disk && !state.snapshot) state.snapshot = disk;
        // A filesystem change during the cache read leaves stale set — keep walking.
        if (!state.stale && disk) {
          state.retryAfter = null;
          return state.snapshot;
        }
      }

      const snapshot = await walkRoot(rootPath, abort.signal);
      if (abort.signal.aborted || state.abort !== abort) return state.snapshot;
      state.snapshot = snapshot;
      state.stale = false;
      state.retryAfter = null;
      await writeDisk(snapshot).catch(() => undefined);
      publishLibraryIndex(state.rootPath, sender);
      return snapshot;
    } catch {
      state.stale = true;
      state.retryAfter = Date.now() + REBUILD_RETRY_MS;
      return state.snapshot;
    } finally {
      if (state.abort === abort) {
        state.building = false;
        state.abort = null;
      }
      if (state.buildPromise === holder.promise) state.buildPromise = null;
    }
  })();

  if (!holder.promise) {
    state.building = false;
    state.abort = null;
    return state.snapshot;
  }
  const promise = holder.promise;
  state.buildPromise = promise;
  return promise;
}

export async function searchLibraryIndex(
  rootPath: string,
  query: string,
  sender?: WebContents,
): Promise<{ ready: boolean; truncated: boolean; hits: GlobalSearchHit[] }> {
  const state = stateFor(rootPath);
  if (!state.snapshot) {
    const snapshot = await ensureLibraryIndex(rootPath, sender);
    if (!snapshot) return { ready: false, truncated: false, hits: [] };
    return { ready: true, ...searchSnapshot(snapshot, query) };
  }
  if (
    libraryIndexNeedsBuild({
      hasSnapshot: true,
      stale: state.stale,
      building: state.building,
      retryAfter: state.retryAfter,
    })
  ) {
    void ensureLibraryIndex(rootPath, sender).catch(() => undefined);
  }
  return { ready: true, ...searchSnapshot(state.snapshot, query) };
}

export async function recentLibraryIndex(
  rootPath: string,
  sender?: WebContents,
  options?: { force?: boolean },
): Promise<{ ready: boolean; truncated: boolean; files: FileEntry[] }> {
  if (options?.force) {
    const snapshot = await ensureLibraryIndex(rootPath, sender, { force: true });
    if (!snapshot) return { ready: false, truncated: false, files: [] };
    return { ready: true, ...recentSnapshot(snapshot) };
  }

  const state = stateFor(rootPath);
  if (!state.snapshot) {
    const snapshot = await ensureLibraryIndex(rootPath, sender);
    if (!snapshot) return { ready: false, truncated: false, files: [] };
    return { ready: true, ...recentSnapshot(snapshot) };
  }
  if (
    libraryIndexNeedsBuild({
      hasSnapshot: true,
      stale: state.stale,
      building: state.building,
      retryAfter: state.retryAfter,
    })
  ) {
    void ensureLibraryIndex(rootPath, sender).catch(() => undefined);
  }
  return { ready: true, ...recentSnapshot(state.snapshot) };
}
