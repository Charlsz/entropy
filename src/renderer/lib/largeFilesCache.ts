import type { FileEntry, LargeFilesScanResult } from "../../shared/types";

export interface LargeFilesCacheSnapshot {
  key: string;
  result: LargeFilesScanResult;
  entries: FileEntry[];
}

let cache: LargeFilesCacheSnapshot | null = null;
const listeners = new Set<() => void>();

export function largeFilesCacheKey(roots: string[]): string {
  return roots
    .map((root) => root.replace(/[/\\]+$/, "").toLowerCase())
    .sort()
    .join("|");
}

export function getLargeFilesCache(): LargeFilesCacheSnapshot | null {
  return cache;
}

export function setLargeFilesCache(next: LargeFilesCacheSnapshot): void {
  cache = next;
  for (const listener of listeners) listener();
}

export function invalidateLargeFilesCache(): void {
  if (!cache) return;
  cache = null;
  for (const listener of listeners) listener();
}

export function subscribeLargeFilesCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toLargeFileEntries(result: LargeFilesScanResult): FileEntry[] {
  return result.files.map((file) => ({
    name: file.name,
    path: file.path,
    isDirectory: false,
    size: file.size,
    modifiedAt: file.modifiedAt,
    extension: file.extension,
  }));
}
