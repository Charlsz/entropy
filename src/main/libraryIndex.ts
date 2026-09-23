import { app } from "electron";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { WebContents } from "electron";
import type { FileEntry, GlobalSearchHit } from "../shared/types";
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

interface RootIndex {
  snapshot: LibraryIndexSnapshot | null;
  stale: boolean;
  building: boolean;
  abort: AbortController | null;
}

const indexes = new Map<string, RootIndex>();

function rootKey(rootPath: string): string {
  return path.normalize(rootPath).replace(/[/\\]+$/, "").toLowerCase();
}

function stateFor(rootPath: string): RootIndex {
  const key = rootKey(rootPath);
  let state = indexes.get(key);
  if (!state) {
    state = { snapshot: null, stale: false, building: false, abort: null };
    indexes.set(key, state);
  }
  return state;
}

function cacheFile(rootPath: string): string {
  const hash = createHash("sha1").update(rootKey(rootPath)).digest("hex");
  return path.join(app.getPath("userData"), "library-indexes", `${hash}.json`);
}

function fresh(state: RootIndex): LibraryIndexSnapshot | null {
  if (!state.snapshot || state.stale) return null;
  return state.snapshot;
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

export function invalidateLibraryIndex(rootPath: string): void {
  const state = stateFor(rootPath);
  state.stale = true;
  state.abort?.abort();
}

async function walkRoot(
  rootPath: string,
  signal: AbortSignal,
): Promise<LibraryIndexSnapshot> {
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
  if (!options?.force) {
    const ready = fresh(state);
    if (ready) return ready;
    if (!state.snapshot && !state.building) {
      const disk = await readDisk(rootPath);
      if (disk && !state.stale) {
        state.snapshot = disk;
        return disk;
      }
    }
  }
  if (state.building && !options?.force) return fresh(state);

  state.abort?.abort();
  const abort = new AbortController();
  state.abort = abort;
  state.building = true;
  state.stale = false;

  try {
    const snapshot = await walkRoot(rootPath, abort.signal);
    if (abort.signal.aborted) return fresh(state);
    state.snapshot = snapshot;
    state.stale = false;
    await writeDisk(snapshot).catch(() => undefined);
    if (sender && !sender.isDestroyed()) {
      sender.send("library:updated", { root: path.normalize(rootPath) });
    }
    return snapshot;
  } finally {
    if (state.abort === abort) {
      state.building = false;
      state.abort = null;
    }
  }
}

export async function searchLibraryIndex(
  rootPath: string,
  query: string,
  sender?: WebContents,
): Promise<{ ready: boolean; truncated: boolean; hits: GlobalSearchHit[] }> {
  const state = stateFor(rootPath);
  const ready = fresh(state) ?? (state.building ? null : await readDisk(rootPath));
  if (ready && !state.snapshot) state.snapshot = ready;
  if (ready && !state.stale) {
    const found = searchSnapshot(ready, query);
    return { ready: true, ...found };
  }
  void ensureLibraryIndex(rootPath, sender).catch(() => undefined);
  return { ready: false, truncated: false, hits: [] };
}

export async function recentLibraryIndex(
  rootPath: string,
  sender?: WebContents,
  options?: { force?: boolean },
): Promise<{ ready: boolean; truncated: boolean; files: FileEntry[] }> {
  if (options?.force) {
    const snapshot = await ensureLibraryIndex(rootPath, sender, { force: true });
    if (!snapshot) return { ready: false, truncated: false, files: [] };
    const recent = recentSnapshot(snapshot);
    return { ready: true, ...recent };
  }
  const found = await searchReadyRecent(rootPath);
  if (found) return found;
  void ensureLibraryIndex(rootPath, sender).catch(() => undefined);
  return { ready: false, truncated: false, files: [] };
}

async function searchReadyRecent(
  rootPath: string,
): Promise<{ ready: true; truncated: boolean; files: FileEntry[] } | null> {
  const state = stateFor(rootPath);
  const ready = fresh(state) ?? (await readDisk(rootPath));
  if (!ready || state.stale) return null;
  if (!state.snapshot) state.snapshot = ready;
  const recent = recentSnapshot(ready);
  return { ready: true, ...recent };
}
