import { app, shell } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertPathMutable } from "../shared/protectedPaths";

/**
 * Brief in-app undo staging. Files sit here only until Undo or dismiss;
 * dismiss / quit moves them into the real OS Recycle Bin / Trash.
 * This keeps Undo fully inside Entropy (Windows cannot restore from Recycle Bin via API).
 */
const pending = new Map<string, string>(); // originalPath -> stagingPath

function stagingRoot(): string {
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

async function moveWithRetry(from: string, to: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
      return;
    } catch (err) {
      lastError = err;
      // Cross-device: fall back to copy + unlink.
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

async function sendToOsTrash(targetPath: string): Promise<void> {
  try {
    await trashOnce(targetPath);
    return;
  } catch (err) {
    if (!isRetryableTrashError(err)) throw friendlyTrashError(targetPath, err);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await sleep(120 * (attempt + 1));
    try {
      await trashOnce(targetPath);
      return;
    } catch (err) {
      if (!isRetryableTrashError(err) || attempt === 4) {
        throw friendlyTrashError(targetPath, err);
      }
    }
  }
}

/**
 * Soft-delete into undo staging (in-app Undo works on every OS).
 * Call `finalizeTrash` on dismiss / quit to put items in the real Recycle Bin.
 */
export async function removeToTrash(targetPath: string): Promise<void> {
  const normalized = normalizeKey(targetPath);
  assertPathMutable(normalized, process.platform, "delete");

  if (!(await pathExists(normalized))) return;

  // Replacing a prior pending delete of the same path — OS-trash the old staging first.
  const existing = pending.get(normalized);
  if (existing) {
    pending.delete(normalized);
    if (await pathExists(existing)) {
      await sendToOsTrash(existing).catch(() =>
        fs.rm(existing, { recursive: true, force: true }),
      );
    }
  }

  const base = path.basename(normalized);
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const staging = path.join(stagingRoot(), `.entropy-undo-${stamp}-${base}`);

  await moveWithRetry(normalized, staging);
  pending.set(normalized, staging);
}

export async function undoRemoves(
  originalPaths: string[],
): Promise<{ restored: number; failed: string[] }> {
  let restored = 0;
  const failed: string[] = [];

  for (const originalPath of originalPaths) {
    const key = normalizeKey(originalPath);
    if (await pathExists(key)) {
      // Already restored or never left.
      const staging = pending.get(key);
      if (staging) {
        pending.delete(key);
        await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
      }
      restored += 1;
      continue;
    }

    const staging = pending.get(key);
    if (staging && (await pathExists(staging))) {
      try {
        await moveWithRetry(staging, key);
        pending.delete(key);
        restored += 1;
        continue;
      } catch {
        failed.push(originalPath);
        continue;
      }
    }

    // Fallback for older sessions / platforms where undo from OS trash works.
    const fromOs = await restoreFromSystemTrash(key);
    if (fromOs) {
      pending.delete(key);
      restored += 1;
    } else {
      failed.push(originalPath);
    }
  }

  return { restored, failed };
}

/** Move staged deletes into the real OS Recycle Bin / Trash (no Explorer window). */
export async function finalizeTrash(originalPaths?: string[]): Promise<void> {
  const keys =
    originalPaths && originalPaths.length > 0
      ? originalPaths.map(normalizeKey)
      : [...pending.keys()];

  for (const key of keys) {
    const staging = pending.get(key);
    pending.delete(key);
    if (!staging) continue;
    if (!(await pathExists(staging))) continue;
    try {
      await sendToOsTrash(staging);
    } catch {
      await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** On launch: anything left in staging goes to the OS trash (session ended mid-undo). */
export async function finalizeOrphanedStaging(): Promise<void> {
  const root = stagingRoot();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = path.join(root, name);
    try {
      await sendToOsTrash(full);
    } catch {
      await fs.rm(full, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  pending.clear();
}

/**
 * Best-effort restore from the OS trash (macOS / Linux).
 * Windows Recycle Bin has no supported restore API — staging Undo covers that path.
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

/** @deprecated Prefer not opening OS file UI from Entropy. Kept for rare explicit tooling. */
export async function openTrash(): Promise<void> {
  await finalizeOrphanedStaging();

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
