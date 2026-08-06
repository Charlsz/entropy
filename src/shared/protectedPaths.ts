import { pathIsUnder, type HostPlatform } from "./platform";

/**
 * OS / volume paths Entropy must not mutate, and should not treat as reclaim candidates.
 * Defense in depth for Inventory deletes, renames, duplicates, and deep scans.
 */

/** Well-known Windows drive-root folder names (matched case-insensitively). */
const WIN_ROOT_DIRS = new Set([
  "windows",
  "program files",
  "program files (x86)",
  "programdata",
  "$recycle.bin",
  "system volume information",
  "recovery",
  "perflogs",
  "boot",
  "efi",
  "documents and settings",
  "config.msi",
  "msocache",
  "intel",
  "amd",
  "nvidia",
]);

/** Files that sit on a drive root and must never be moved/trashed. */
const WIN_ROOT_FILES = new Set([
  "pagefile.sys",
  "hiberfil.sys",
  "swapfile.sys",
  "bootmgr",
  "bootnxt",
  "bootsect.bak",
  "autoexec.bat",
  "config.sys",
  "io.sys",
  "msdos.sys",
  "ntldr",
  "ntdetect.com",
]);

/**
 * Directory basenames to skip during deep walks (any depth).
 * Tooling / package trees and build outputs — reclaim must not target language runtimes or app installs.
 * Matched case-insensitively.
 */
const SKIP_DIR_COMMON_LOWER = new Set(
  [
    "node_modules",
    "bower_components",
    "jspm_packages",
    "elm-stuff",
    "__pycache__",
    "site-packages",
    "venv",
    "virtualenv",
    "Pods",
    "Carthage",
    "DerivedData",
    "vendor",
    "dist",
    "build",
    "cmake-build-debug",
    "cmake-build-release",
    "xcuserdata",
    "pyenv",
    "conda-meta",
    "miniconda3",
    "anaconda3",
    ".git",
    ".svn",
    ".hg",
    ".next",
    ".cache",
    ".gradle",
    ".nuget",
    ".cargo",
    ".rustup",
    ".npm",
    ".yarn",
    ".pnpm-store",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    ".dart_tool",
    ".pub-cache",
  ].map((name) => name.toLowerCase()),
);

const SKIP_DIR_WIN = new Set([
  "$Recycle.Bin",
  "System Volume Information",
  "Windows",
  "Program Files",
  "Program Files (x86)",
  "ProgramData",
  "Recovery",
  "PerfLogs",
  "Boot",
  "EFI",
  "AppData",
  "Application Data",
  "Cookies",
  "Local Settings",
  "My Documents",
  "NetHood",
  "PrintHood",
  "Recent",
  "SendTo",
  "Start Menu",
  "Templates",
  "My Music",
  "My Pictures",
  "My Videos",
]);

const SKIP_DIR_WIN_LOWER = new Set([...SKIP_DIR_WIN].map((n) => n.toLowerCase()));

/** Absolute Unix trees that must never be mutated (except /usr/local). */
const UNIX_PROTECTED_PREFIXES = [
  "/system",
  "/bin",
  "/sbin",
  "/boot",
  "/dev",
  "/etc",
  "/proc",
  "/sys",
  "/run",
  "/lib",
  "/lib64",
  "/lib32",
  "/private/var/db",
  "/private/etc",
  "/cores",
] as const;

function normalizeSlashes(filePath: string): string {
  return filePath.replace(/[/\\]+$/, "").replace(/\\/g, "/");
}

function winDriveAndRest(normalized: string): { drive: string; rest: string } | null {
  const match = /^([a-zA-Z]:)(?:\/(.*))?$/.exec(normalized);
  if (!match) return null;
  return { drive: match[1], rest: match[2] ?? "" };
}

function isWindowsProtected(normalized: string): boolean {
  const parts = winDriveAndRest(normalized);
  if (!parts) {
    // UNC admin shares etc.
    const unc = normalized.toLowerCase();
    if (unc.startsWith("//") || unc.startsWith("\\\\\\\\")) {
      if (unc.includes("/windows/") || unc.endsWith("/windows")) return true;
      if (unc.includes("/program files")) return true;
    }
    return false;
  }

  // Drive root itself (C:) — never trash/rename the volume.
  if (!parts.rest) return true;

  const segments = parts.rest.split("/").filter(Boolean);
  const top = segments[0]?.toLowerCase() ?? "";
  if (WIN_ROOT_DIRS.has(top)) return true;

  if (segments.length === 1 && WIN_ROOT_FILES.has(top)) return true;

  return false;
}

function isUnixProtected(normalized: string, platform: HostPlatform): boolean {
  if (!normalized || normalized === "/") return true;

  const path = normalized.startsWith("/") ? normalized : `/${normalized}`;
  const lower = path.toLowerCase();

  // /usr is protected; /usr/local is user-install space and allowed.
  if (lower === "/usr" || lower.startsWith("/usr/")) {
    if (lower === "/usr/local" || lower.startsWith("/usr/local/")) return false;
    return true;
  }

  for (const prefix of UNIX_PROTECTED_PREFIXES) {
    if (pathIsUnder(path, prefix, platform)) return true;
  }

  // System Library only (not ~/Library).
  if (platform === "darwin" && pathIsUnder(path, "/Library", platform)) return true;
  // Installed apps — never reclaim from system application trees.
  if (platform === "darwin" && pathIsUnder(path, "/Applications", platform)) return true;
  if (platform === "darwin" && pathIsUnder(path, "/System/Applications", platform)) return true;

  // Common Linux OS install roots.
  if (platform === "linux") {
    if (pathIsUnder(path, "/snap", platform)) return true;
    if (pathIsUnder(path, "/var/lib/apt", platform)) return true;
    if (pathIsUnder(path, "/var/lib/dpkg", platform)) return true;
    if (pathIsUnder(path, "/usr/lib", platform)) return true;
    if (pathIsUnder(path, "/usr/share", platform)) return true;
  }

  return false;
}

/** True when path is an OS / volume location Entropy must not mutate. */
export function isProtectedOsPath(filePath: string, platform: HostPlatform): boolean {
  if (!filePath || !filePath.trim()) return true;
  const normalized = normalizeSlashes(filePath);

  if (platform === "win32") return isWindowsProtected(normalized);
  return isUnixProtected(normalized, platform);
}

/**
 * Basename skip for deep directory walks (duplicates / measure / trees).
 * Broader than mutate guards — also skips noisy user profile junctions and language tooling trees.
 */
export function isProtectedOsDirName(name: string, platform: HostPlatform): boolean {
  if (!name || name === "." || name === "..") return true;
  if (name.startsWith(".")) return true;
  if (SKIP_DIR_COMMON_LOWER.has(name.toLowerCase())) return true;

  if (platform === "win32") {
    if (SKIP_DIR_WIN_LOWER.has(name.toLowerCase())) return true;
  }

  if (platform === "darwin" && name === "Library") return true;
  if (platform === "darwin" && name.toLowerCase() === "applications") return true;

  return false;
}

/**
 * True when any path segment is a skipped tooling / system directory.
 * Defense in depth for duplicate scan results and reclaim selection.
 */
export function pathHasSkippedDirSegment(filePath: string, platform: HostPlatform): boolean {
  const normalized = normalizeSlashes(filePath);
  const segments = normalized.split("/").filter(Boolean);
  // Drop Windows drive letter.
  const start = segments[0]?.endsWith(":") ? 1 : 0;
  for (let i = start; i < segments.length; i += 1) {
    const seg = segments[i]!;
    // Terminal segment with an extension is a file name (e.g. note.md), not a folder.
    if (i === segments.length - 1) {
      const dot = seg.lastIndexOf(".");
      if (dot > 0) continue;
    }
    if (isProtectedOsDirName(seg, platform)) return true;
  }
  return false;
}

/** True when a path must never be offered for duplicate reclaim. */
export function isUnsafeReclaimPath(filePath: string, platform: HostPlatform): boolean {
  return isProtectedOsPath(filePath, platform) || pathHasSkippedDirSegment(filePath, platform);
}

export function protectedPathMessage(filePath: string, action = "change"): string {
  const name = normalizeSlashes(filePath).split("/").filter(Boolean).pop() || filePath;
  return `Protected system path — Entropy will not ${action} "${name}".`;
}

/** Throw if this path must not be renamed, trashed, overwritten, or copied onto. */
export function assertPathMutable(filePath: string, platform: HostPlatform, action = "change"): void {
  if (isProtectedOsPath(filePath, platform)) {
    throw new Error(protectedPathMessage(filePath, action));
  }
}
