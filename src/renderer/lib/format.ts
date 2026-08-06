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

/** Compact modified labels for the Library table (Figma-style). */
export function formatModifiedLabel(timestamp: number, now = Date.now()): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (timestamp >= startOfToday.getTime()) return `Today, ${time}`;
  if (timestamp >= startOfYesterday.getTime()) return `Yesterday, ${time}`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/** Show paths as ~/… when under home. */
export function formatUserPath(filePath: string, homePath: string | null): string {
  if (!homePath) return filePath;
  const normalized = filePath.replace(/\\/g, "/");
  const home = homePath.replace(/\\/g, "/").replace(/\/$/, "");
  if (normalized === home) return "~";
  if (normalized.toLowerCase().startsWith(`${home.toLowerCase()}/`)) {
    return `~${normalized.slice(home.length)}`;
  }
  return filePath;
}
