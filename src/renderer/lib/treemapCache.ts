import type { TreemapScanResult } from "../../shared/types";

export interface TreemapCacheSnapshot {
  folderKey: string;
  scan: TreemapScanResult;
}

let cache: TreemapCacheSnapshot | null = null;
const listeners = new Set<() => void>();

export function treemapCacheKey(folderPath: string): string {
  return folderPath.replace(/[/\\]+$/, "").toLowerCase();
}

export function getTreemapCache(): TreemapCacheSnapshot | null {
  return cache;
}

export function setTreemapCache(next: TreemapCacheSnapshot): void {
  cache = next;
  for (const listener of listeners) listener();
}

export function invalidateTreemapCache(): void {
  if (!cache) return;
  cache = null;
  for (const listener of listeners) listener();
}

export function subscribeTreemapCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
