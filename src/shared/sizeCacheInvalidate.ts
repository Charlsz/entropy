/**
 * Whether a cached folder size must be dropped after a change at `changedPath`.
 * Descendants and ancestors are both stale: a nested edit changes parent totals,
 * and a parent change covers everything under it.
 */
export function sizeCacheKeyMatchesChange(cacheKey: string, changedPath: string): boolean {
  const key = cacheKey.replace(/[/\\]+$/, "").replace(/\\/g, "/").toLowerCase();
  const changed = changedPath.replace(/[/\\]+$/, "").replace(/\\/g, "/").toLowerCase();
  if (!key || !changed) return false;
  if (key === changed) return true;
  return changed.startsWith(`${key}/`) || key.startsWith(`${changed}/`);
}
