import { app, shell } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let legacyPurgeStarted = false;

/** Remove the old AppData trash-bin if a previous build created one. */
function purgeLegacyBin(): void {
  if (legacyPurgeStarted) return;
  legacyPurgeStarted = true;
  const legacy = path.join(app.getPath("userData"), "trash-bin");
  void fs.rm(legacy, { recursive: true, force: true }).catch(() => undefined);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Move into the user's Recycle Bin / Trash via the OS (Electron shell.trashItem).
 * Entropy does not keep a parallel trash folder.
 *
 * Windows frequently aborts IFileOperation while media previews still hold the
 * file — retry with backoff before surfacing a clear locked-file error.
 */
export async function removeToTrash(targetPath: string): Promise<void> {
  purgeLegacyBin();
  const normalized = path.normalize(targetPath);
  const attempts = 8;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await shell.trashItem(normalized);
      return;
    } catch (err) {
      lastError = err;
      if (!isRetryableTrashError(err) || attempt === attempts - 1) break;
      await sleep(100 * (attempt + 1));
    }
  }

  throw friendlyTrashError(normalized, lastError);
}

function isRetryableTrashError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /operation was aborted|ebusy|eperm|access is denied|being used by another process|locked/i.test(
    message,
  );
}

function friendlyTrashError(targetPath: string, err: unknown): Error {
  const name = path.basename(targetPath);
  if (isRetryableTrashError(err)) {
    return new Error(
      `Couldn't move "${name}" to the Recycle Bin - the file is still in use. Close any preview and try again.`,
    );
  }
  return err instanceof Error ? err : new Error(`Failed to delete "${name}"`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function undoRemoves(originalPaths: string[]): Promise<{ restored: number; failed: string[] }> {
  let restored = 0;
  const failed: string[] = [];

  for (const originalPath of originalPaths) {
    const ok = await undoOne(originalPath);
    if (ok) restored += 1;
    else failed.push(originalPath);
  }

  return { restored, failed };
}

async function undoOne(originalPath: string): Promise<boolean> {
  const normalized = path.normalize(originalPath);
  if (await pathExists(normalized)) return true;
  return restoreFromSystemTrash(normalized);
}

/**
 * Best-effort restore from the OS trash.
 * macOS/Linux can often rename out of Trash; Windows Recycle Bin has no
 * supported restore API — callers should open Recycle Bin for recovery.
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
      // Fall through to basename match.
    }

    const candidate = path.join(filesDir, name);
    if (await pathExists(candidate)) {
      await fs.mkdir(path.dirname(originalPath), { recursive: true });
      await fs.rename(candidate, originalPath);
      await fs.rm(path.join(infoDir, `${name}.trashinfo`), { force: true }).catch(() => undefined);
      return true;
    }
  }

  // Windows: Recycle Bin restore is intentional OS UI — no reliable Electron API.
  return false;
}

/** Open the real Recycle Bin (Windows) or Trash (macOS / Linux). */
export async function openTrash(): Promise<void> {
  purgeLegacyBin();

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
