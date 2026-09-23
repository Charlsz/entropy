import type { FileEntry, GlobalSearchHit, InventoryRoot } from "../../shared/types";
import type { LibraryPerspective } from "../types/library";
import { isUnderPath } from "./platform";

export function pickRoot(folder: string, roots: InventoryRoot[]): InventoryRoot | null {
  const matches = roots.filter((root) => isUnderPath(folder, root.path));
  matches.sort((a, b) => b.path.length - a.path.length);
  return matches[0] ?? null;
}

export function parentFolderPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized.startsWith("/") ? "/" : filePath;
  const parent = normalized.slice(0, idx);
  // Preserve original separators for display/formatUserPath.
  if (filePath.includes("\\") && !filePath.includes("/")) {
    return parent.replace(/\//g, "\\");
  }
  return parent;
}

export function hitToFileEntry(hit: GlobalSearchHit): FileEntry {
  const raw =
    hit.source === "folder"
      ? ""
      : hit.name.includes(".")
        ? (hit.name.split(".").pop() ?? "")
        : "";
  const extension = raw ? (raw.startsWith(".") ? raw.toLowerCase() : `.${raw.toLowerCase()}`) : "";
  return {
    name: hit.name,
    path: hit.path,
    isDirectory: hit.source === "folder",
    size: 0,
    modifiedAt: 0,
    extension,
  };
}

export function normalizePerspective(value: string | undefined): LibraryPerspective {
  if (value === "gallery" || value === "large-files" || value === "duplicates" || value === "recent") {
    return value;
  }
  return "folders";
}
