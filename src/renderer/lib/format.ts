/**
 * Label for File Intelligence "consuming … with similar files".
 * Zero other bytes must stay zero — a file with no duplicates is not consuming its own size again.
 */
export function formatSimilarConsumption(otherBytes: number | null): string {
  if (otherBytes == null) return "…";
  return formatBytes(otherBytes);
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const TB = GB * 1024;
const PB = TB * 1024;

/** Shared byte formatting for Inventory / Storage. */
export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "—";
  if (size < KB) return `${size} B`;
  if (size < MB) return `${(size / KB).toFixed(1)} KB`;
  if (size < GB) return `${(size / MB).toFixed(1)} MB`;
  if (size < TB) return `${(size / GB).toFixed(1)} GB`;
  if (size < PB) return `${(size / TB).toFixed(1)} TB`;
  return `${(size / PB).toFixed(1)} PB`;
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
