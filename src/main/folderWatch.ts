import { type WebContents } from "electron";
import fs from "node:fs";
import path from "node:path";
import { invalidateSizeCacheUnder } from "./inventory";

const DEBOUNCE_MS = 220;

interface ActiveWatch {
  watcher: fs.FSWatcher;
  recursive: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Per-renderer directory watches so Inventory/Notebook stay live with the disk. */
const bySender = new Map<number, Map<string, ActiveWatch>>();

function normalizeDir(dirPath: string): string {
  return path.normalize(path.resolve(dirPath));
}

function senderMap(webContents: WebContents): Map<string, ActiveWatch> {
  let map = bySender.get(webContents.id);
  if (!map) {
    map = new Map();
    bySender.set(webContents.id, map);
    webContents.once("destroyed", () => {
      clearSender(webContents.id);
    });
  }
  return map;
}

function clearSender(senderId: number): void {
  const map = bySender.get(senderId);
  if (!map) return;
  for (const active of map.values()) {
    if (active.timer) clearTimeout(active.timer);
    active.watcher.close();
  }
  bySender.delete(senderId);
}

function notify(webContents: WebContents, dirPath: string): void {
  if (webContents.isDestroyed()) return;
  webContents.send("fs:dir-changed", { path: dirPath });
}

function scheduleNotify(webContents: WebContents, dirPath: string, active: ActiveWatch): void {
  if (active.timer) clearTimeout(active.timer);
  active.timer = setTimeout(() => {
    active.timer = null;
    invalidateSizeCacheUnder(dirPath);
    notify(webContents, dirPath);
  }, DEBOUNCE_MS);
}

export function watchDir(
  webContents: WebContents,
  dirPath: string,
  options?: { recursive?: boolean },
): void {
  const resolved = normalizeDir(dirPath);
  const recursive = Boolean(options?.recursive);
  const map = senderMap(webContents);
  const existing = map.get(resolved);

  if (existing) {
    if (existing.recursive === recursive) return;
    if (existing.timer) clearTimeout(existing.timer);
    existing.watcher.close();
    map.delete(resolved);
  }

  try {
    const watcher = fs.watch(resolved, { recursive }, () => {
      const active = map.get(resolved);
      if (!active) return;
      scheduleNotify(webContents, resolved, active);
    });
    watcher.on("error", () => {
      const active = map.get(resolved);
      if (!active) return;
      if (active.timer) clearTimeout(active.timer);
      active.watcher.close();
      map.delete(resolved);
    });
    map.set(resolved, { watcher, recursive, timer: null });
  } catch {
    // Directory missing or not watchable — listing refresh will surface the error.
  }
}

export function unwatchDir(webContents: WebContents, dirPath: string): void {
  const resolved = normalizeDir(dirPath);
  const map = bySender.get(webContents.id);
  if (!map) return;
  const active = map.get(resolved);
  if (!active) return;
  if (active.timer) clearTimeout(active.timer);
  active.watcher.close();
  map.delete(resolved);
  if (map.size === 0) bySender.delete(webContents.id);
}

export function unwatchAll(webContents: WebContents): void {
  clearSender(webContents.id);
}
