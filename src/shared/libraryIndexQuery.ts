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

interface RecentRank {
  entry: LibraryIndexEntry;
  index: number;
}

/** Higher mtime first; equal mtimes keep earlier index, matching a stable sort. */
function recentBefore(left: RecentRank, right: RecentRank): boolean {
  if (left.entry.modifiedAt !== right.entry.modifiedAt) {
    return left.entry.modifiedAt > right.entry.modifiedAt;
  }
  return left.index < right.index;
}

function insertRecent(ranked: RecentRank[], item: RecentRank): void {
  let low = 0;
  let high = ranked.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (recentBefore(item, ranked[mid]!)) high = mid;
    else low = mid + 1;
  }
  ranked.splice(low, 0, item);
}

/** Newest files, same order as sorting the full list, without sorting every entry. */
export function selectRecentEntries(
  entries: readonly LibraryIndexEntry[],
  limit: number,
): LibraryIndexEntry[] {
  if (limit <= 0) return [];
  const ranked: RecentRank[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    if (entry.isDirectory) continue;
    const item = { entry, index };
    if (ranked.length < limit) {
      insertRecent(ranked, item);
      continue;
    }
    const worst = ranked[ranked.length - 1]!;
    if (!recentBefore(item, worst)) continue;
    ranked.pop();
    insertRecent(ranked, item);
  }
  return ranked.map((item) => item.entry);
}

export function recentSnapshot(
  snapshot: LibraryIndexSnapshot,
  limit = RECENT_LIMIT,
): { truncated: boolean; files: FileEntry[] } {
  const files = selectRecentEntries(snapshot.entries, limit).map(
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
