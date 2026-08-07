import fs from "node:fs/promises";
import path from "node:path";
import { isProtectedOsDirName, isUnsafeReclaimPath } from "../../shared/protectedPaths";
import type { ScannedFile } from "./types";

export interface ScanOptions {
  signal?: AbortSignal;
  onFile?: (file: ScannedFile, seen: number) => void;
  maxDepth?: number;
  /** Hard cap on metadata rows held in memory (huge disks). */
  maxFiles?: number;
  /** When set, only files with these extensions (lowercase, with dot) are collected. */
  extensions?: ReadonlySet<string> | null;
}

/** Default soft ceiling — each ScannedFile is small, but multi‑million arrays thrash RAM. */
export const DEFAULT_MAX_SCAN_FILES = 250_000;
const MAX_SCAN_ERRORS = 2_000;

/**
 * Recursively collect file metadata only — never reads file contents.
 * Skips OS-protected trees and language/tooling directories so reclaim cannot target them.
 * Stops once maxFiles is reached and reports truncated.
 */
export async function scanFiles(
  rootPath: string,
  options: ScanOptions = {},
): Promise<{
  files: ScannedFile[];
  errors: Array<{ path: string; error: string }>;
  truncated: boolean;
}> {
  const root = path.normalize(rootPath);
  const files: ScannedFile[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  const maxDepth = options.maxDepth ?? 32;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_SCAN_FILES;
  const platform = process.platform;
  let seen = 0;
  let truncated = false;

  if (isUnsafeReclaimPath(root, platform)) {
    return {
      files: [],
      errors: [
        {
          path: root,
          error: "Protected system path — skipped for duplicate scanning",
        },
      ],
      truncated: false,
    };
  }

  function pushError(entryPath: string, message: string): void {
    if (errors.length >= MAX_SCAN_ERRORS) return;
    errors.push({ path: entryPath, error: message });
  }

  async function walk(dir: string, depth: number): Promise<void> {
    if (options.signal?.aborted || truncated) return;
    if (depth > maxDepth) return;
    if (isUnsafeReclaimPath(dir, platform)) return;

    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      pushError(dir, err instanceof Error ? err.message : "Cannot read directory");
      return;
    }

    for (const dirent of dirents) {
      if (options.signal?.aborted || truncated) return;
      if (dirent.name === "." || dirent.name === "..") continue;
      if (isProtectedOsDirName(dirent.name, platform)) continue;

      const full = path.join(dir, dirent.name);
      if (isUnsafeReclaimPath(full, platform)) continue;

      try {
        const link = await fs.lstat(full);
        if (link.isSymbolicLink()) continue;

        if (link.isDirectory()) {
          await walk(full, depth + 1);
          continue;
        }

        if (!link.isFile() || link.size <= 0) continue;

        const extension = path.extname(dirent.name).toLowerCase();
        if (options.extensions && !options.extensions.has(extension)) continue;

        if (files.length >= maxFiles) {
          truncated = true;
          return;
        }

        const file: ScannedFile = {
          path: full,
          name: dirent.name,
          size: link.size,
          mtimeMs: link.mtimeMs,
          ctimeMs: link.ctimeMs,
          dev: typeof link.dev === "number" ? link.dev : null,
          ino: typeof link.ino === "number" ? link.ino : null,
          extension,
        };
        files.push(file);
        seen += 1;
        options.onFile?.(file, seen);
      } catch (err) {
        pushError(full, err instanceof Error ? err.message : "Cannot stat entry");
      }
    }
  }

  await walk(root, 0);
  return { files, errors, truncated };
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

/**
 * Collapse hard links (same device + inode) to one path per physical file.
 * Extra hard-link paths are not reclaimable disk waste.
 */
export function collapseHardLinks(files: ScannedFile[]): ScannedFile[] {
  const seen = new Set<string>();
  const out: ScannedFile[] = [];
  for (const file of files) {
    if (file.dev != null && file.ino != null) {
      const key = `${file.dev}:${file.ino}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(file);
  }
  return out;
}
