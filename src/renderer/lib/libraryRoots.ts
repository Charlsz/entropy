import type { InventoryRoot } from "../../shared/types";
import { basename } from "./paths";
import { samePath } from "./platform";

/** Label for a Library root: known place, drive letter, or folder name. */
export function libraryRootLabel(rootPath: string, roots: InventoryRoot[]): string {
  const match = roots.find((root) => samePath(root.path, rootPath));
  if (match) return match.name;
  const drive = /^([A-Za-z]):[\\/]*$/.exec(rootPath.trim());
  if (drive?.[1]) return `${drive[1].toUpperCase()}:`;
  return basename(rootPath) || rootPath;
}

/**
 * Drives and user-added folders stay the breadcrumb root.
 * Home, Desktop, Documents, and the other places stay anchored to Home.
 */
export function shouldPinLibraryRoot(root: InventoryRoot): boolean {
  return (
    root.id.startsWith("drive-") ||
    root.id.startsWith("volume-") ||
    root.id.startsWith("mount-") ||
    root.id.startsWith("extra-")
  );
}
