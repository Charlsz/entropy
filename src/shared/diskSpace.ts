/** Pure disk-space math used by the sidebar meter and main-process volume probe. */

export interface VolumeSpace {
  free: number;
  total: number;
}

export type StorageFillTone = "ink" | "ink-accent" | "accent" | "accent-muted";

/** Interpret Node `statfs` fields into user-facing free/total bytes. */
export function volumeSpaceFromStatfs(stats: {
  bsize: number | bigint;
  blocks: number | bigint;
  bavail?: number | bigint;
  bfree?: number | bigint;
}): VolumeSpace | null {
  const block = Number(stats.bsize) || 4096;
  const total = Number(stats.blocks) * block;
  const rawFree = Number(stats.bavail ?? stats.bfree);
  if (!Number.isFinite(total) || total <= 0) return null;
  const free = Number.isFinite(rawFree) ? Math.max(0, rawFree * block) : 0;
  return { free, total: Math.max(total, free) };
}

/** Occupied fraction for the storage meter. Invalid totals stay empty. */
export function occupiedDiskRatio(free: number, total: number): number {
  if (!Number.isFinite(free) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, (total - Math.max(0, free)) / total));
}

/** Palette tone for the meter fill — stays in ink/accent, no status reds. */
export function storageFillTone(occupiedRatio: number): StorageFillTone {
  if (occupiedRatio >= 0.9) return "ink";
  if (occupiedRatio >= 0.75) return "ink-accent";
  if (occupiedRatio >= 0.5) return "accent";
  return "accent-muted";
}

export function storageFillCss(tone: StorageFillTone): string {
  switch (tone) {
    case "ink":
      return "var(--color-ink)";
    case "ink-accent":
      return "color-mix(in srgb, var(--color-ink) 72%, var(--color-accent))";
    case "accent":
      return "var(--color-accent)";
    case "accent-muted":
      return "color-mix(in srgb, var(--color-accent) 70%, var(--color-muted))";
  }
}

/** Drive letter on Windows so the footer can follow the open volume. */
export function volumeLabel(targetPath: string | null | undefined, platform: string): string | null {
  if (!targetPath) return null;
  if (platform === "win32") {
    const match = targetPath.match(/^([a-zA-Z]):/);
    return match ? `${match[1]!.toUpperCase()}:` : null;
  }
  return null;
}

/**
 * Paths to try for `statfs`, walking toward the volume root, then Home.
 * A deleted folder still needs the parent volume.
 */
export function collectDiskSpaceProbes(targetPath: string, homePath?: string): string[] {
  const probes: string[] = [];
  const seen = new Set<string>();

  let current = targetPath.replace(/[/\\]+$/, "") || targetPath;
  current = current.replace(/\//g, platformSep(targetPath));

  while (current && !seen.has(foldProbe(current))) {
    seen.add(foldProbe(current));
    probes.push(current);
    const parent = parentPath(current);
    if (parent === current) break;
    current = parent;
  }

  if (homePath) {
    const home = homePath.replace(/[/\\]+$/, "") || homePath;
    if (!seen.has(foldProbe(home))) probes.push(home);
  }
  return probes;
}

function foldProbe(value: string): string {
  return value.replace(/[/\\]+$/, "").replace(/\\/g, "/").toLowerCase();
}

function platformSep(sample: string): string {
  return sample.includes("\\") && !sample.includes("/") ? "\\" : "/";
}

function parentPath(value: string): string {
  const sep = platformSep(value);
  const trimmed = value.replace(/[/\\]+$/, "") || value;
  const winRoot = trimmed.match(/^([a-zA-Z]:)$/);
  if (winRoot) return `${winRoot[1]}${sep}`;
  const slash = trimmed.lastIndexOf("/");
  const back = trimmed.lastIndexOf("\\");
  const cut = Math.max(slash, back);
  if (cut <= 0) {
    if (trimmed.startsWith("/")) return "/";
    return trimmed;
  }
  const parent = trimmed.slice(0, cut);
  if (/^[a-zA-Z]:$/.test(parent)) return `${parent}${sep}`;
  return parent || trimmed;
}
