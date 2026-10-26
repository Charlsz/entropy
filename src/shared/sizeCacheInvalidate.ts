import { pathIdentityKey } from "./pathIdentity";

function foldSizePath(value: string, platform: string): string {
  return pathIdentityKey(value.replace(/\\/g, "/"), platform);
}

/**
 * Whether a cached folder size must be dropped after a change at `changedPath`.
 * Descendants and ancestors are both stale: a nested edit changes parent totals,
 * and a parent change covers everything under it.
 */
export function sizeCacheKeyMatchesChange(
  cacheKey: string,
  changedPath: string,
  platform = "linux",
): boolean {
  const key = foldSizePath(cacheKey, platform);
  const changed = foldSizePath(changedPath, platform);
  if (!key || !changed) return false;
  if (key === changed) return true;
  return changed.startsWith(`${key}/`) || key.startsWith(`${changed}/`);
}
