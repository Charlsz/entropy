/** Shared byte formatting for Inventory / Storage. */
export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Share of parent size for calm folder-weight cues (0–1). */
export function sizeShare(size: number, parentTotal: number): number {
  if (parentTotal <= 0 || size <= 0) return 0;
  return Math.min(1, size / parentTotal);
}
