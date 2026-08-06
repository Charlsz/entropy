import { hostPlatform } from "./platform";

/** Root of the volume that contains folderPath (e.g. `C:\` or `/`). */
export function volumeRootFor(folderPath: string): string {
  const platform = hostPlatform();
  const normalized = folderPath.replace(/\\/g, "/");

  if (platform === "win32") {
    const match = folderPath.match(/^([A-Za-z]:)([/\\]|$)/);
    if (match) return `${match[1]}\\`;
    return folderPath;
  }

  if (normalized.startsWith("/Volumes/")) {
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length >= 2) return `/${parts[0]}/${parts[1]}`;
  }

  if (normalized.startsWith("/media/") || normalized.startsWith("/mnt/")) {
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length >= 2) return `/${parts.slice(0, 2).join("/")}`;
    if (parts.length === 1) return `/${parts[0]}`;
  }

  return "/";
}
