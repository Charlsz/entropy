import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { InventoryRoot } from "../shared/types";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".cache",
  "$Recycle.Bin",
  "System Volume Information",
  "AppData",
]);

const sizeCache = new Map<string, { size: number; mtimeMs: number }>();

export async function getInventoryRoots(): Promise<InventoryRoot[]> {
  const candidates: Array<{ id: string; name: string; path: string }> = [
    { id: "home", name: "Home", path: app.getPath("home") },
    { id: "desktop", name: "Desktop", path: app.getPath("desktop") },
    { id: "documents", name: "Documents", path: app.getPath("documents") },
    { id: "downloads", name: "Downloads", path: app.getPath("downloads") },
    { id: "pictures", name: "Pictures", path: app.getPath("pictures") },
    { id: "music", name: "Music", path: app.getPath("music") },
    { id: "videos", name: "Videos", path: app.getPath("videos") },
  ];

  const roots: InventoryRoot[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate.path);
    if (seen.has(normalized.toLowerCase())) continue;
    try {
      const info = await fs.stat(normalized);
      if (!info.isDirectory()) continue;
      seen.add(normalized.toLowerCase());
      roots.push({ ...candidate, path: normalized });
    } catch {
      // Skip missing special folders on this platform.
    }
  }

  return roots;
}

export function getHomePath(): string {
  return path.normalize(app.getPath("home"));
}

/** Recursive size; caches by path+mtime. Skips heavy/system dirs. */
export async function measurePath(targetPath: string): Promise<number> {
  const normalized = path.normalize(targetPath);
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
  if (SKIP_DIRS.has(name)) {
    sizeCache.set(normalized, { size: 0, mtimeMs: info.mtimeMs });
    return 0;
  }

  let total = 0;
  let dirents;
  try {
    dirents = await fs.readdir(normalized, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const dirent of dirents) {
    if (dirent.name === "." || dirent.name === "..") continue;
    if (SKIP_DIRS.has(dirent.name)) continue;
    const child = path.join(normalized, dirent.name);
    try {
      total += await measurePath(child);
    } catch {
      // Ignore inaccessible children.
    }
  }

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

  const results: Array<{ path: string; size: number }> = [];
  for (const dirent of dirents) {
    if (dirent.name === "." || dirent.name === "..") continue;
    if (SKIP_DIRS.has(dirent.name)) continue;
    const child = path.join(dirPath, dirent.name);
    const size = await measurePath(child);
    results.push({ path: child, size });
  }
  return results;
}

export function clearSizeCache(): void {
  sizeCache.clear();
}
