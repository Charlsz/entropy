/**
 * Pure decisions for the library index so search/recent can keep showing the
 * last snapshot while a rebuild is in flight, without treating it as fresh.
 */

export interface LibraryIndexFlags {
  hasSnapshot: boolean;
  stale: boolean;
  building: boolean;
  /** Skip automatic rebuilds until this epoch ms after a failed walk. */
  retryAfter?: number | null;
}

export function libraryIndexNeedsBuild(flags: LibraryIndexFlags, now = Date.now()): boolean {
  if (flags.building) return false;
  if (flags.retryAfter != null && now < flags.retryAfter) return false;
  if (!flags.hasSnapshot) return true;
  return flags.stale;
}

function nested(parent: string, child: string): boolean {
  if (parent === child) return true;
  if (!parent || !child) return false;
  const windows = /^[a-z]:/i.test(parent) || parent.includes("\\") || child.includes("\\");
  const sep = windows ? "\\" : "/";
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child.toLowerCase().startsWith(prefix.toLowerCase());
}

/** True when a filesystem change should refresh this index root. */
export function indexCoversChange(rootKey: string, changedKey: string): boolean {
  return nested(rootKey, changedKey) || nested(changedKey, rootKey);
}
