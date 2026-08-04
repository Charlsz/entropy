import { app, shell } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertPathMutable } from "../shared/protectedPaths";

/**
 * Delete flow (macOS / Windows / Linux):
 * 1. Copy into a private undo cache (Entropy userData) so Undo works in-app —
 *    Windows cannot restore from Recycle Bin via API.
 * 2. Immediately `shell.trashItem` the real path → OS Recycle Bin / Trash.
 * 3. Dismiss / quit only deletes the undo cache (OS trash already has the file).
 */
const pending = new Map<string, string>(); // originalPath -> undoCachePath

function undoCacheRoot(): string {
  return path.join(app.getPath("userData"), "undo-staging");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function normalizeKey(targetPath: string): string {
  return path.normalize(targetPath);
}

function isRetryableTrashError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /operation was aborted|ebusy|eperm|access is denied|being used by another process|locked|eacces|failed to move|file is in use/i.test(
    message,
  );
}

function friendlyTrashError(targetPath: string, err: unknown): Error {
  const name = path.basename(targetPath).replace(/^\.entropy-undo-\d+-[a-z0-9]+-/i, "");
  if (isRetryableTrashError(err)) {
    return new Error(
      `Couldn't move "${name}" to the trash — the file is still in use. Close any preview and try again.`,
    );
  }
  return err instanceof Error ? err : new Error(`Failed to delete "${name}"`);
}

async function copyWithRetry(from: string, to: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rm(to, { recursive: true, force: true }).catch(() => undefined);
      await fs.cp(from, to, { recursive: true, force: true });
      return;
    } catch (err) {
      lastError = err;
      if (!isRetryableTrashError(err) || attempt === 7) break;
      await sleep(120 * (attempt + 1));
    }
  }
  throw friendlyTrashError(from, lastError);
}

async function moveWithRetry(from: string, to: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
      return;
    } catch (err) {
      lastError = err;
      if ((err as NodeJS.ErrnoException | undefined)?.code === "EXDEV") {
        await fs.cp(from, to, { recursive: true });
        await fs.rm(from, { recursive: true, force: true });
        return;
      }
      if (!isRetryableTrashError(err) || attempt === 11) break;
      await sleep(120 * (attempt + 1));
    }
  }
  throw friendlyTrashError(from, lastError);
}

async function trashOnce(targetPath: string): Promise<void> {
  await shell.trashItem(path.normalize(targetPath));
}

/**
 * When Windows refuses trash while Chromium still maps the path, rename first.
 * Rename usually succeeds for read locks and breaks the mapping so Recycle Bin can proceed.
 */
async function renameAside(targetPath: string): Promise<string> {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const staging = path.join(dir, `.entropy-trash-${stamp}-${base}`);

  let lastError: unknown;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await fs.rename(targetPath, staging);
      return staging;
    } catch (err) {
      lastError = err;
      if (!isRetryableTrashError(err) || attempt === 11) break;
      await sleep(120 * (attempt + 1));
    }
  }
  throw friendlyTrashError(targetPath, lastError);
}

async function sendToOsTrash(targetPath: string): Promise<void> {
  const normalized = path.normalize(targetPath);

  try {
    await trashOnce(normalized);
    return;
  } catch (err) {
    if (!isRetryableTrashError(err)) throw friendlyTrashError(normalized, err);
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await sleep(120 * (attempt + 1));
    try {
      await trashOnce(normalized);
      return;
    } catch (err) {
      if (!isRetryableTrashError(err)) throw friendlyTrashError(normalized, err);
    }
  }

  let aside: string | null = null;
  try {
    aside = await renameAside(normalized);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await trashOnce(aside);
        return;
      } catch (err) {
        if (!isRetryableTrashError(err) || attempt === 5) throw err;
        await sleep(150 * (attempt + 1));
      }
    }
  } catch (err) {
    if (aside && (await pathExists(aside)) && !(await pathExists(normalized))) {
      await fs.rename(aside, normalized).catch(() => undefined);
    }
    throw friendlyTrashError(normalized, err);
  }
}

async function clearUndoCache(cachePath: string | undefined): Promise<void> {
  if (!cachePath) return;
  await fs.rm(cachePath, { recursive: true, force: true }).catch(() => undefined);
}

/**
 * Copy for in-app Undo, then move the real file into the OS Recycle Bin / Trash.
 */
export async function removeToTrash(targetPath: string): Promise<void> {
  const normalized = normalizeKey(targetPath);
  assertPathMutable(normalized, process.platform, "delete");

  if (!(await pathExists(normalized))) return;

  const existing = pending.get(normalized);
  if (existing) {
    pending.delete(normalized);
    await clearUndoCache(existing);
  }

  const base = path.basename(normalized);
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const cachePath = path.join(undoCacheRoot(), `.entropy-undo-${stamp}-${base}`);

  // Undo buffer first — if OS trash fails we can put the file back.
  await copyWithRetry(normalized, cachePath);
  pending.set(normalized, cachePath);

  try {
    await sendToOsTrash(normalized);
  } catch (err) {
    // Roll back: restore original from cache and surface the trash error.
    pending.delete(normalized);
    try {
      if (!(await pathExists(normalized))) {
        await moveWithRetry(cachePath, normalized);
      } else {
        await clearUndoCache(cachePath);
      }
    } catch {
      // Keep cache if restore failed so Undo might still recover.
      pending.set(normalized, cachePath);
    }
    throw err;
  }
}

export async function undoRemoves(
  originalPaths: string[],
): Promise<{ restored: number; failed: string[] }> {
  let restored = 0;
  const failed: string[] = [];

  for (const originalPath of originalPaths) {
    const key = normalizeKey(originalPath);
    const cachePath = pending.get(key);

    if (await pathExists(key)) {
      // Already on disk (user recovered manually, etc.) — drop undo cache.
      pending.delete(key);
      await clearUndoCache(cachePath);
      restored += 1;
      continue;
    }

    if (cachePath && (await pathExists(cachePath))) {
      try {
        await moveWithRetry(cachePath, key);
        pending.delete(key);
        restored += 1;
        continue;
      } catch {
        failed.push(originalPath);
        continue;
      }
    }

    // Fallback: pull out of OS trash when the platform allows (macOS / Linux).
    const fromOs = await restoreFromSystemTrash(key);
    if (fromOs) {
      pending.delete(key);
      await clearUndoCache(cachePath);
      restored += 1;
    } else {
      failed.push(originalPath);
    }
  }

  return { restored, failed };
}

/** Drop undo-cache copies after the bar is dismissed (file is already in OS trash). */
export async function finalizeTrash(originalPaths?: string[]): Promise<void> {
  const keys =
    originalPaths && originalPaths.length > 0
      ? originalPaths.map(normalizeKey)
      : [...pending.keys()];

  for (const key of keys) {
    const cachePath = pending.get(key);
    pending.delete(key);
    await clearUndoCache(cachePath);
  }
}

/** On launch: leftover undo-cache / old soft-deletes go to the real OS trash. */
export async function finalizeOrphanedStaging(): Promise<void> {
  const root = undoCacheRoot();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    pending.clear();
    return;
  }
  for (const name of entries) {
    const full = path.join(root, name);
    try {
      // Previous builds soft-moved here without OS trash — recover into Recycle Bin.
      await sendToOsTrash(full);
    } catch {
      await fs.rm(full, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  pending.clear();
}

/**
 * Best-effort restore from the OS trash (macOS / Linux).
 * Windows Recycle Bin has no supported restore API — undo-cache covers that path.
 */
async function restoreFromSystemTrash(originalPath: string): Promise<boolean> {
  const name = path.basename(originalPath);

  if (process.platform === "darwin") {
    const candidate = path.join(os.homedir(), ".Trash", name);
    if (await pathExists(candidate)) {
      await fs.mkdir(path.dirname(originalPath), { recursive: true });
      await fs.rename(candidate, originalPath);
      return true;
    }
    return false;
  }

  if (process.platform === "linux") {
    const filesDir = path.join(os.homedir(), ".local", "share", "Trash", "files");
    const infoDir = path.join(os.homedir(), ".local", "share", "Trash", "info");
    try {
      const infos = await fs.readdir(infoDir);
      for (const infoName of infos) {
        if (!infoName.endsWith(".trashinfo")) continue;
        const infoPath = path.join(infoDir, infoName);
        const body = await fs.readFile(infoPath, "utf8");
        const match = /^Path=(.+)$/m.exec(body);
        if (!match) continue;
        const trashedPath = decodeURIComponent(match[1].trim());
        if (path.normalize(trashedPath) !== path.normalize(originalPath)) continue;
        const stagedName = infoName.replace(/\.trashinfo$/i, "");
        const staged = path.join(filesDir, stagedName);
        if (!(await pathExists(staged))) continue;
        await fs.mkdir(path.dirname(originalPath), { recursive: true });
        await fs.rename(staged, originalPath);
        await fs.rm(infoPath, { force: true }).catch(() => undefined);
        return true;
      }
    } catch {
      // Fall through.
    }

    const candidate = path.join(filesDir, name);
    if (await pathExists(candidate)) {
      await fs.mkdir(path.dirname(originalPath), { recursive: true });
      await fs.rename(candidate, originalPath);
      await fs.rm(path.join(infoDir, `${name}.trashinfo`), { force: true }).catch(() => undefined);
      return true;
    }
  }

  return false;
}

/** Kept for rare tooling — prefer never opening OS file UI from product chrome. */
export async function openTrash(): Promise<void> {
  if (process.platform === "win32") {
    await shell.openExternal("shell:RecycleBinFolder");
    return;
  }
  if (process.platform === "darwin") {
    await shell.openPath(path.join(os.homedir(), ".Trash"));
    return;
  }
  await shell.openPath(path.join(os.homedir(), ".local", "share", "Trash", "files"));
}
