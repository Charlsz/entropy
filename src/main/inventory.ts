import { app, BrowserWindow, dialog } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
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

const sizeCache = new Map<string, { size: number; mtimeMs: number }>();

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
    for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
      await pushIfDir(roots, seen, {
        id: `drive-${letter.toLowerCase()}`,
        name: `${letter}:`,
        path: `${letter}:\\`,
      });
    }
    return roots;
  }

  if (process.platform === "darwin") {
    try {
      const entries = await fs.readdir("/Volumes");
      for (const name of entries) {
        await pushIfDir(roots, seen, {
          id: `volume-${name}`,
          name,
          path: path.join("/Volumes", name),
        });
      }
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
      for (const name of entries) {
        await pushIfDir(roots, seen, {
          id: `mount-${base}-${name}`,
          name,
          path: path.join(base, name),
        });
      }
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
