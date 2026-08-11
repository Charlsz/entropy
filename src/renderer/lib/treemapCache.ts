import type { TreemapScanResult } from "../../shared/types";

export interface TreemapCacheSnapshot {
  folderKey: string;
  scan: TreemapScanResult;
}

let cache: TreemapCacheSnapshot | null = null;

export function treemapCacheKey(folderPath: string): string {
  return folderPath.replace(/[/\\]+$/, "").toLowerCase();
}

export function getTreemapCache(): TreemapCacheSnapshot | null {
  return cache;
}

export function setTreemapCache(next: TreemapCacheSnapshot): void {
  cache = next;
}

export function invalidateTreemapCache(): void {
  cache = null;
}
