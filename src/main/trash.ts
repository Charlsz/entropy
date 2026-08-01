import { app, shell } from "electron";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

interface TrashMeta {
  originalPath: string;
  trashedAt: number;
  basename: string;
}

interface TrashEntry {
  id: string;
  originalPath: string;
}

/** Session journal of recent trash moves (Entropy recoverable bin). */
let recent: TrashEntry[] = [];

function trashRoot(): string {
  return path.join(app.getPath("userData"), "trash-bin");
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
 * Move into Entropy's recoverable trash (same-volume rename when possible).
 * Falls back to the system Trash when rename cannot complete — those items
 * remain recoverable in the OS Trash until emptied, but Undo may not restore them.
 */
export async function removeToTrash(targetPath: string): Promise<void> {
  const id = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const destDir = path.join(trashRoot(), id);
  const basename = path.basename(targetPath);
  const destPath = path.join(destDir, basename);
  const meta: TrashMeta = {
    originalPath: targetPath,
    trashedAt: Date.now(),
    basename,
  };

  try {
    await fs.mkdir(destDir, { recursive: true });
    await fs.rename(targetPath, destPath);
    await fs.writeFile(path.join(destDir, "meta.json"), JSON.stringify(meta), "utf8");
    recent = [{ id, originalPath: targetPath }, ...recent.filter((e) => e.originalPath !== targetPath)].slice(
      0,
      200,
    );
  } catch {
    await fs.rm(destDir, { recursive: true, force: true }).catch(() => undefined);
    await shell.trashItem(targetPath);
    // System trash — recorded without id so Undo can still try OS restore.
    recent = [{ id: "", originalPath: targetPath }, ...recent].slice(0, 200);
  }
}

export async function undoRemoves(originalPaths: string[]): Promise<{ restored: number; failed: string[] }> {
  let restored = 0;
  const failed: string[] = [];

  for (const originalPath of originalPaths) {
    const ok = await undoOne(originalPath);
    if (ok) restored += 1;
    else failed.push(originalPath);
  }

  recent = recent.filter((entry) => !originalPaths.includes(entry.originalPath));
  return { restored, failed };
}

async function undoOne(originalPath: string): Promise<boolean> {
  if (await pathExists(originalPath)) return true;

  const entry = recent.find((item) => item.originalPath === originalPath);
  if (entry?.id) {
    const destDir = path.join(trashRoot(), entry.id);
    const metaPath = path.join(destDir, "meta.json");
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as TrashMeta;
      const staged = path.join(destDir, meta.basename);
      await fs.mkdir(path.dirname(originalPath), { recursive: true });
      await fs.rename(staged, originalPath);
      await fs.rm(destDir, { recursive: true, force: true });
      return true;
    } catch {
      // Fall through to OS trash probes.
    }
  }

  return restoreFromSystemTrash(originalPath);
}

async function restoreFromSystemTrash(originalPath: string): Promise<boolean> {
  const name = path.basename(originalPath);

  if (process.platform === "darwin") {
    const candidate = path.join(os.homedir(), ".Trash", name);
    if (await pathExists(candidate)) {
      await fs.rename(candidate, originalPath);
      return true;
    }
  }

  if (process.platform === "linux") {
    const candidate = path.join(os.homedir(), ".local", "share", "Trash", "files", name);
    if (await pathExists(candidate)) {
      await fs.rename(candidate, originalPath);
      const info = path.join(
        os.homedir(),
        ".local",
        "share",
        "Trash",
        "info",
        `${name}.trashinfo`,
      );
      await fs.rm(info, { force: true }).catch(() => undefined);
      return true;
    }
  }

  return false;
}

/** Reveal the recoverable trash location (Entropy bin, or OS Trash). */
export async function openTrash(): Promise<void> {
  const root = trashRoot();
  try {
    await fs.mkdir(root, { recursive: true });
    const opened = await shell.openPath(root);
    if (!opened) return;
  } catch {
    // Fall through.
  }

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
