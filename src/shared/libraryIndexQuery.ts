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
  const prefix: GlobalSearchHit[] = [];
  const contains: GlobalSearchHit[] = [];
  for (const entry of snapshot.entries) {
    const index = entry.name.toLowerCase().indexOf(trimmed);
    if (index < 0) continue;
    const hit: GlobalSearchHit = {
      path: entry.path,
      name: entry.name,
      excerpt: entry.path,
      source: entry.isDirectory ? "folder" : "file",
    };
    if (index === 0) prefix.push(hit);
    else contains.push(hit);
  }
  const total = prefix.length + contains.length;
  const hits = [...prefix, ...contains].slice(0, SEARCH_LIMIT);
  return { truncated: snapshot.truncated || total > SEARCH_LIMIT, hits };
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
