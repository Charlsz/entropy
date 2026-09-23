import type { FileEntry, GlobalSearchHit } from "./types";

export interface LibraryIndexEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  extension: string;
}

export interface LibraryIndexSnapshot {
  root: string;
  builtAt: number;
  truncated: boolean;
  entries: LibraryIndexEntry[];
}

const SEARCH_LIMIT = 40;
const RECENT_LIMIT = 200;

export function searchSnapshot(
  snapshot: LibraryIndexSnapshot,
  query: string,
): { truncated: boolean; hits: GlobalSearchHit[] } {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return { truncated: snapshot.truncated, hits: [] };
  const hits: GlobalSearchHit[] = [];
  for (const entry of snapshot.entries) {
    if (!entry.name.toLowerCase().includes(trimmed)) continue;
    hits.push({
      path: entry.path,
      name: entry.name,
      excerpt: entry.path,
      source: entry.isDirectory ? "folder" : "file",
    });
    if (hits.length >= SEARCH_LIMIT) break;
  }
  return { truncated: snapshot.truncated, hits };
}

export function recentSnapshot(
  snapshot: LibraryIndexSnapshot,
  limit = RECENT_LIMIT,
): { truncated: boolean; files: FileEntry[] } {
  const files = snapshot.entries
    .filter((entry) => !entry.isDirectory)
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .slice(0, limit)
    .map(
      (entry): FileEntry => ({
        name: entry.name,
        path: entry.path,
        isDirectory: false,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
        extension: entry.extension,
      }),
    );
  return { truncated: snapshot.truncated, files };
}
