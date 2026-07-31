import fs from "node:fs/promises";
import path from "node:path";
import type { ScannedFile } from "./types";

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
]);

export interface ScanOptions {
  signal?: AbortSignal;
  onFile?: (file: ScannedFile, seen: number) => void;
  maxDepth?: number;
}

/**
 * Recursively collect file metadata only — never reads file contents.
 */
export async function scanFiles(
  rootPath: string,
  options: ScanOptions = {},
): Promise<{ files: ScannedFile[]; errors: Array<{ path: string; error: string }> }> {
  const root = path.normalize(rootPath);
  const files: ScannedFile[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  const maxDepth = options.maxDepth ?? 32;
  let seen = 0;

  async function walk(dir: string, depth: number): Promise<void> {
    if (options.signal?.aborted) return;
    if (depth > maxDepth) return;

    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      errors.push({
        path: dir,
        error: err instanceof Error ? err.message : "Cannot read directory",
      });
      return;
    }

    for (const dirent of dirents) {
      if (options.signal?.aborted) return;
      if (dirent.name === "." || dirent.name === "..") continue;
      if (dirent.name.startsWith(".")) continue;
      if (SKIP_DIRS.has(dirent.name)) continue;

      const full = path.join(dir, dirent.name);
      try {
        const link = await fs.lstat(full);
        if (link.isSymbolicLink()) continue;

        if (link.isDirectory()) {
          await walk(full, depth + 1);
          continue;
        }

        if (!link.isFile() || link.size <= 0) continue;

        const file: ScannedFile = {
          path: full,
          name: dirent.name,
          size: link.size,
          mtimeMs: link.mtimeMs,
          ctimeMs: link.ctimeMs,
          ino: typeof link.ino === "number" ? link.ino : null,
          extension: path.extname(dirent.name).toLowerCase(),
        };
        files.push(file);
        seen += 1;
        options.onFile?.(file, seen);
      } catch (err) {
        errors.push({
          path: full,
          error: err instanceof Error ? err.message : "Cannot stat entry",
        });
      }
    }
  }

  await walk(root, 0);
  return { files, errors };
}

/** Group files by size; drop singletons. */
export function groupBySize(files: ScannedFile[]): Map<number, ScannedFile[]> {
  const map = new Map<number, ScannedFile[]>();
  for (const file of files) {
    const list = map.get(file.size) ?? [];
    list.push(file);
    map.set(file.size, list);
  }
  for (const [size, list] of map) {
    if (list.length < 2) map.delete(size);
  }
  return map;
}
