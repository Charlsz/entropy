export const TREEMAP_OTHER_SUFFIX = ".__entropy_other__";

export function isAggregateLeaf(leaf: { path: string; name: string }): boolean {
  return leaf.path.endsWith(TREEMAP_OTHER_SUFFIX) || leaf.name.startsWith("Other (");
}

export function otherLeafPath(rootPath: string): string {
  const trimmed = rootPath.replace(/[/\\]+$/, "") || rootPath;
  const sep = rootPath.includes("\\") ? "\\" : "/";
  return `${trimmed}${sep}${TREEMAP_OTHER_SUFFIX}`;
}

export function capTreemapLeaves<T extends { size: number }>(
  collected: T[],
  maxLeaves: number,
  makeOther: (rest: T[], restSize: number) => T,
): { files: T[]; truncated: boolean } {
  if (collected.length === 0 || collected.length <= maxLeaves) {
    return { files: collected, truncated: false };
  }

  const kept = collected.slice(0, maxLeaves - 1);
  const rest = collected.slice(maxLeaves - 1);
  let restSize = 0;
  for (const file of rest) restSize += file.size;
  kept.push(makeOther(rest, restSize));
  return { files: kept, truncated: true };
}
