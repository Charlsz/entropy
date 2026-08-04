/** Host OS helpers — Entropy runs on macOS, Windows, and Linux. */

export type HostPlatform = "darwin" | "win32" | "linux" | string;

export function isMac(platform: HostPlatform): boolean {
  return platform === "darwin";
}

export function isWindows(platform: HostPlatform): boolean {
  return platform === "win32";
}

export function isLinux(platform: HostPlatform): boolean {
  return platform === "linux";
}

/** OS trash UI name. */
export function trashDisplayName(platform: HostPlatform): string {
  return isWindows(platform) ? "Recycle Bin" : "Trash";
}

/** Reveal-in-folder action label. */
export function revealInFolderLabel(platform: HostPlatform): string {
  if (isMac(platform)) return "Show in Finder";
  if (isWindows(platform)) return "Show in Explorer";
  return "Show in Files";
}

/** Modifier key for shortcut hints. */
export function modKeyLabel(platform: HostPlatform): string {
  return isMac(platform) ? "⌘" : "Ctrl";
}

/**
 * Compare filesystem paths for the host OS.
 * Windows + macOS default volumes are case-insensitive; Linux is not.
 */
export function pathsEqual(a: string, b: string, platform: HostPlatform): boolean {
  const left = a.replace(/[/\\]+$/, "").replace(/\\/g, "/");
  const right = b.replace(/[/\\]+$/, "").replace(/\\/g, "/");
  if (isLinux(platform)) return left === right;
  return left.toLowerCase() === right.toLowerCase();
}

/** Whether `child` is under `parent` (or the same path). */
export function pathIsUnder(child: string, parent: string, platform: HostPlatform): boolean {
  const c = child.replace(/[/\\]+$/, "").replace(/\\/g, "/");
  const p = parent.replace(/[/\\]+$/, "").replace(/\\/g, "/");
  if (pathsEqual(c, p, platform)) return true;
  const prefix = p.endsWith("/") ? p : `${p}/`;
  if (isLinux(platform)) return c.startsWith(prefix);
  return c.toLowerCase().startsWith(prefix.toLowerCase());
}
