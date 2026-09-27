import fs from "node:fs/promises";
import path from "node:path";

/** In-app undo copies stay under this size so userData is not doubled. */
export const UNDO_COPY_MAX_BYTES = 80 * 1024 * 1024;

export type UndoPlan =
  | { action: "restore-cache" }
  | { action: "count-restored" }
  | { action: "fail"; dropCache: false }
  | { action: "try-system-trash" };

/**
 * In-app undo. If something else already occupies the original path, keep the
 * undo copy — deleting it would report success and throw away the only buffer.
 */
export function planUndo(destinationExists: boolean, cacheExists: boolean): UndoPlan {
  if (!destinationExists && cacheExists) return { action: "restore-cache" };
  if (destinationExists && cacheExists) return { action: "fail", dropCache: false };
  if (destinationExists) return { action: "count-restored" };
  return { action: "try-system-trash" };
}

/** Path recorded in a FreeDesktop `.trashinfo` file, or null when it is absent. */
export function trashInfoPath(body: string): string | null {
  const match = /^Path=(.+)$/m.exec(body);
  if (!match?.[1]) return null;
  const raw = match[1].trim();
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Byte size of a file or directory, walking only until `cap`.
 * Returns null when the tree is larger than `cap` (caller should skip the undo copy).
 * Directory `stat.size` is not content size — folders must be walked.
 */
export async function bytesUntilCap(targetPath: string, cap: number): Promise<number | null> {
  const info = await fs.lstat(targetPath);
  if (info.isSymbolicLink()) return null;
  if (!info.isDirectory()) return info.size <= cap ? info.size : null;

  let total = 0;
  async function walk(dir: string): Promise<boolean> {
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return true;
    }
    for (const dirent of dirents) {
      if (dirent.name === "." || dirent.name === "..") continue;
      const full = path.join(dir, dirent.name);
      let stat;
      try {
        stat = await fs.lstat(full);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        const ok = await walk(full);
        if (!ok) return false;
        continue;
      }
      if (!stat.isFile()) continue;
      total += stat.size;
      if (total > cap) return false;
    }
    return true;
  }

  const within = await walk(targetPath);
  return within ? total : null;
}
