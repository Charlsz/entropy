import { app, BrowserWindow, dialog } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { InventoryRoot, TreemapFileLeaf, TreemapScanResult, GlobalSearchHit } from "../shared/types";
import { kindFromExtension } from "../shared/fileKinds";
import { mapPool } from "./asyncPool";

const SKIP_DIRS_COMMON = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".cache",
]);

/** Windows profile / system folders that thrash scans and confuse measure. */
const SKIP_DIRS_WINDOWS = new Set([
  "$Recycle.Bin",
  "System Volume Information",
  "AppData",
  "Application Data",
  "Cookies",
  "Local Settings",
  "My Documents",
  "NetHood",
  "PrintHood",
  "Recent",
  "SendTo",
  "Start Menu",
  "Templates",
  "My Music",
  "My Pictures",
  "My Videos",
]);

function shouldSkipMeasureDir(name: string): boolean {
  if (SKIP_DIRS_COMMON.has(name)) return true;
  if (process.platform === "win32" && SKIP_DIRS_WINDOWS.has(name)) return true;
  // Library under Home is huge and rarely what users mean by “what's using space”.
  if (process.platform === "darwin" && name === "Library") return true;
  return false;
}

const MEASURE_CONCURRENCY = 6;
const sizeCache = new Map<string, { size: number; mtimeMs: number }>();
/** Coalesce concurrent measurePath calls (measureChildren ∥ scanTreemapLevel). */
const measureInflight = new Map<string, Promise<number>>();

async function pushIfDir(
  roots: InventoryRoot[],
  seen: Set<string>,
  candidate: { id: string; name: string; path: string },
): Promise<void> {
  const normalized = path.normalize(candidate.path);
  const key = normalized.toLowerCase();
  if (seen.has(key)) return;
  try {
    const info = await fs.stat(normalized);
    if (!info.isDirectory()) return;
    seen.add(key);
    roots.push({ ...candidate, path: normalized });
  } catch {
    // Skip missing paths.
  }
}

/** Discover attached drives / volumes without scanning them by default. */
export async function listMountRoots(): Promise<InventoryRoot[]> {
  const roots: InventoryRoot[] = [];
  const seen = new Set<string>();

  if (process.platform === "win32") {
    await Promise.all(
      Array.from("CDEFGHIJKLMNOPQRSTUVWXYZ").map((letter) =>
        pushIfDir(roots, seen, {
          id: `drive-${letter.toLowerCase()}`,
          name: `${letter}:`,
          path: `${letter}:\\`,
        }),
      ),
    );
    return roots;
  }

  if (process.platform === "darwin") {
    try {
      const entries = await fs.readdir("/Volumes");
      await Promise.all(
        entries.map((name) =>
          pushIfDir(roots, seen, {
            id: `volume-${name}`,
            name,
            path: path.join("/Volumes", name),
          }),
        ),
      );
    } catch {
      // No Volumes folder.
    }
    return roots;
  }

  // Linux and others: common mount points under /media and /mnt.
  const user = os.userInfo().username;
  for (const base of [path.join("/media", user), "/media", "/mnt"]) {
    try {
      const entries = await fs.readdir(base);
      await Promise.all(
        entries.map((name) =>
          pushIfDir(roots, seen, {
            id: `mount-${base}-${name}`,
            name,
            path: path.join(base, name),
          }),
        ),
      );
    } catch {
      // Skip inaccessible mount bases.
    }
  }
  return roots;
}

export async function getInventoryRoots(extraPaths: string[] = []): Promise<InventoryRoot[]> {
  const roots: InventoryRoot[] = [];
  const seen = new Set<string>();

  const candidates: Array<{ id: string; name: string; path: string }> = [
    { id: "home", name: "Home", path: app.getPath("home") },
    { id: "desktop", name: "Desktop", path: app.getPath("desktop") },
    { id: "documents", name: "Documents", path: app.getPath("documents") },
    { id: "downloads", name: "Downloads", path: app.getPath("downloads") },
    { id: "pictures", name: "Pictures", path: app.getPath("pictures") },
    { id: "music", name: "Music", path: app.getPath("music") },
    { id: "videos", name: "Videos", path: app.getPath("videos") },
  ];

  for (const candidate of candidates) {
    await pushIfDir(roots, seen, candidate);
  }

  for (const extra of extraPaths) {
    const normalized = path.normalize(extra);
    const name = path.basename(normalized) || normalized;
    await pushIfDir(roots, seen, {
      id: `extra-${normalized.toLowerCase()}`,
      name,
      path: normalized,
    });
  }

  return roots;
}

export async function pickInventoryFolder(
  browserWindow: BrowserWindow | null,
): Promise<string | null> {
  const options = {
    title: "Add folder to File Inventory",
    properties: ["openDirectory" as const],
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  return path.normalize(result.filePaths[0]);
}

/** Pick any file for repairing a broken note link (path stays on disk; no import). */
export async function pickFile(
  browserWindow: BrowserWindow | null,
  defaultPath?: string,
): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    title: "Locate file",
    properties: ["openFile"],
    defaultPath: defaultPath ? path.normalize(defaultPath) : undefined,
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  return path.normalize(result.filePaths[0]);
}

export function getHomePath(): string {
  return path.normalize(app.getPath("home"));
}

/** Recursive size; caches by path+mtime. Skips heavy/system dirs. */
export async function measurePath(targetPath: string): Promise<number> {
  const normalized = path.normalize(targetPath);
  const inflight = measureInflight.get(normalized);
  if (inflight) return inflight;

  const job = measurePathUncached(normalized).finally(() => {
    measureInflight.delete(normalized);
  });
  measureInflight.set(normalized, job);
  return job;
}

async function measurePathUncached(normalized: string): Promise<number> {
  let info;
  try {
    info = await fs.lstat(normalized);
  } catch {
    return 0;
  }

  if (info.isSymbolicLink()) return 0;

  if (!info.isDirectory()) {
    return info.size;
  }

  const cached = sizeCache.get(normalized);
  if (cached && cached.mtimeMs === info.mtimeMs) return cached.size;

  const name = path.basename(normalized);
  if (shouldSkipMeasureDir(name)) {
    sizeCache.set(normalized, { size: 0, mtimeMs: info.mtimeMs });
    return 0;
  }

  let dirents;
  try {
    dirents = await fs.readdir(normalized, { withFileTypes: true });
  } catch {
    return 0;
  }

  const children = dirents
    .filter((dirent) => dirent.name !== "." && dirent.name !== ".." && !shouldSkipMeasureDir(dirent.name))
    .map((dirent) => path.join(normalized, dirent.name));

  const sizes = await mapPool(children, MEASURE_CONCURRENCY, async (child) => {
    try {
      return await measurePath(child);
    } catch {
      return 0;
    }
  });

  let total = 0;
  for (const size of sizes) total += size;

  sizeCache.set(normalized, { size: total, mtimeMs: info.mtimeMs });
  return total;
}

export async function measureChildren(
  dirPath: string,
): Promise<Array<{ path: string; size: number }>> {
  let dirents;
  try {
    dirents = await fs.readdir(path.normalize(dirPath), { withFileTypes: true });
  } catch {
    return [];
  }

  const children = dirents
    .filter((dirent) => dirent.name !== "." && dirent.name !== ".." && !shouldSkipMeasureDir(dirent.name))
    .map((dirent) => path.join(dirPath, dirent.name));

  return mapPool(children, MEASURE_CONCURRENCY, async (child) => ({
    path: child,
    size: await measurePath(child),
  }));
}

export function clearSizeCache(): void {
  sizeCache.clear();
}

/** Drop cached sizes under a folder after an external change. */
export function invalidateSizeCacheUnder(dirPath: string): void {
  const prefix = path.normalize(dirPath).replace(/[/\\]+$/, "").toLowerCase();
  for (const key of [...sizeCache.keys()]) {
    const normalized = key.replace(/[/\\]+$/, "").toLowerCase();
    if (
      normalized === prefix ||
      normalized.startsWith(`${prefix}\\`) ||
      normalized.startsWith(`${prefix}/`)
    ) {
      sizeCache.delete(key);
    }
  }
}

const MAX_SCAN_DEPTH = 14;
const DEFAULT_MAX_LEAVES = 2200;

/** Recursively collect files for a GrandPerspective-style treemap (leaves = files). */
export async function scanTreemapFiles(
  rootPath: string,
  maxLeaves = DEFAULT_MAX_LEAVES,
): Promise<TreemapScanResult> {
  const collected: TreemapFileLeaf[] = [];
  await walkFiles(path.normalize(rootPath), 0, collected);

  let totalSize = 0;
  for (const file of collected) totalSize += file.size;
  collected.sort((a, b) => b.size - a.size);

  if (collected.length <= maxLeaves) {
    return {
      files: collected,
      totalSize,
      fileCount: collected.length,
      truncated: false,
    };
  }

  const kept = collected.slice(0, maxLeaves - 1);
  const rest = collected.slice(maxLeaves - 1);
  let restSize = 0;
  for (const file of rest) restSize += file.size;
  kept.push({
    path: path.join(rootPath, ".__entropy_other__"),
    name: `Other (${rest.length.toLocaleString()} files)`,
    size: restSize,
    extension: "",
    kind: "other",
  });

  return {
    files: kept,
    totalSize,
    fileCount: collected.length,
    truncated: true,
  };
}

async function walkFiles(
  dirPath: string,
  depth: number,
  out: TreemapFileLeaf[],
): Promise<void> {
  if (depth > MAX_SCAN_DEPTH) return;
  let dirents;
  try {
    dirents = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  const location = path.basename(dirPath);
  for (const dirent of dirents) {
    if (dirent.name === "." || dirent.name === "..") continue;
    if (shouldSkipMeasureDir(dirent.name)) continue;
    if (dirent.name.startsWith(".")) continue;
    const fullPath = path.join(dirPath, dirent.name);
    try {
      const link = await fs.lstat(fullPath);
      if (link.isSymbolicLink()) continue;
      if (link.isDirectory()) {
        await walkFiles(fullPath, depth + 1, out);
        continue;
      }
      if (!link.isFile() || link.size <= 0) continue;
      const extension = path.extname(dirent.name).toLowerCase();
      out.push({
        path: fullPath,
        name: dirent.name,
        size: link.size,
        extension,
        kind: kindFromExtension(extension),
        isDirectory: false,
        location,
        modifiedAt: link.mtimeMs,
      });
    } catch {
      // Skip inaccessible entries.
    }
  }
}

/**
 * One-level map scan: folders + files at this depth (Google Maps–style zoom).
 * Folder sizes are recursive totals so double-click can drill in.
 * Only folds into Other when the leaf count would overwhelm the map.
 */
export async function scanTreemapLevel(dirPath: string): Promise<TreemapScanResult> {
  const root = path.normalize(dirPath);
  const location = path.basename(root);
  let dirents;
  try {
    dirents = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return { files: [], totalSize: 0, fileCount: 0, truncated: false };
  }

  const collected: TreemapFileLeaf[] = [];
  const direntsFiltered = dirents.filter(
    (dirent) =>
      dirent.name !== "." &&
      dirent.name !== ".." &&
      !shouldSkipMeasureDir(dirent.name) &&
      !dirent.name.startsWith("."),
  );

  await mapPool(direntsFiltered, MEASURE_CONCURRENCY, async (dirent) => {
    const fullPath = path.join(root, dirent.name);
    try {
      const link = await fs.lstat(fullPath);
      if (link.isSymbolicLink()) return;

      if (link.isDirectory()) {
        const size = await measurePath(fullPath);
        if (size <= 0) return;
        collected.push({
          path: fullPath,
          name: dirent.name,
          size,
          extension: "",
          kind: "other",
          isDirectory: true,
          location,
          modifiedAt: link.mtimeMs,
        });
        return;
      }

      if (!link.isFile() || link.size <= 0) return;
      const extension = path.extname(dirent.name).toLowerCase();
      collected.push({
        path: fullPath,
        name: dirent.name,
        size: link.size,
        extension,
        kind: kindFromExtension(extension),
        isDirectory: false,
        location,
        modifiedAt: link.mtimeMs,
      });
    } catch {
      // Skip inaccessible entries.
    }
  });

  let totalSize = 0;
  for (const file of collected) totalSize += file.size;
  collected.sort((a, b) => b.size - a.size);

  const { files, truncated } = capLeafCount(collected, root, location);

  return {
    files,
    totalSize,
    fileCount: collected.length,
    truncated,
  };
}

/**
 * Keep every sized leaf visible. Only fold into Other when there are simply
 * too many siblings for a usable map (not because they are small).
 */
function capLeafCount(
  collected: TreemapFileLeaf[],
  root: string,
  location: string,
): { files: TreemapFileLeaf[]; truncated: boolean } {
  if (collected.length === 0) {
    return { files: collected, truncated: false };
  }

  if (collected.length <= LEVEL_MAX_LEAVES) {
    return { files: collected, truncated: false };
  }

  const kept = collected.slice(0, LEVEL_MAX_LEAVES - 1);
  const rest = collected.slice(LEVEL_MAX_LEAVES - 1);
  let restSize = 0;
  for (const file of rest) restSize += file.size;
  kept.push({
    path: path.join(root, ".__entropy_other__"),
    name: `Other (${rest.length.toLocaleString()} items)`,
    size: restSize,
    extension: "",
    kind: "other",
    isDirectory: false,
    location,
  });

  return { files: kept, truncated: true };
}

const LEVEL_MAX_LEAVES = 120;

const NAME_SEARCH_MAX_DEPTH = 8;
const NAME_SEARCH_MAX_RESULTS = 40;

/** Bounded name search under an Inventory root (files + folders). */
export async function searchInventoryNames(
  rootPath: string,
  query: string,
): Promise<GlobalSearchHit[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const results: GlobalSearchHit[] = [];
  const root = path.normalize(rootPath);

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > NAME_SEARCH_MAX_DEPTH || results.length >= NAME_SEARCH_MAX_RESULTS) return;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const dirent of dirents) {
      if (results.length >= NAME_SEARCH_MAX_RESULTS) return;
      if (dirent.name === "." || dirent.name === "..") continue;
      if (shouldSkipMeasureDir(dirent.name)) continue;
      if (dirent.name.startsWith(".")) continue;
      const full = path.join(dir, dirent.name);
      try {
        const link = await fs.lstat(full);
        if (link.isSymbolicLink()) continue;
        const nameHit = dirent.name.toLowerCase().includes(trimmed);
        if (link.isDirectory()) {
          if (nameHit) {
            results.push({
              path: full,
              name: dirent.name,
              excerpt: full,
              source: "folder",
            });
          }
          await walk(full, depth + 1);
          continue;
        }
        if (!link.isFile()) continue;
        if (!nameHit) continue;
        results.push({
          path: full,
          name: dirent.name,
          excerpt: full,
          source: "file",
        });
      } catch {
        // Skip inaccessible.
      }
    }
  }

  await walk(root, 0);
  return results;
}
