import type { ItemAction } from "../components/ItemActionsMenu";
import { revealInFolderLabel } from "../../shared/platform";

export type { ItemAction };

export async function copyPath(filePath: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(filePath);
  } catch {
    // Clipboard may be unavailable in some environments.
  }
}

export async function revealPath(filePath: string): Promise<void> {
  await window.entropy.fs.reveal(filePath);
}

export async function moveEntryToFolder(
  sourcePath: string,
  destinationFolder: string,
): Promise<string> {
  const name = await window.entropy.fs.basename(sourcePath);
  const target = await window.entropy.fs.join(destinationFolder, name);
  if (target === sourcePath) return sourcePath;
  if (await window.entropy.fs.exists(target)) {
    throw new Error("An item with that name already exists in the destination.");
  }
  await window.entropy.fs.rename(sourcePath, target);
  return target;
}

export function buildEntryActions(options: {
  canReference?: boolean;
  /** Defaults to "Reference" (Notebook). Inventory uses "Add to Workspace". */
  referenceLabel?: string;
  onRename: () => void;
  onReference?: () => void;
  onCopyPath: () => void;
  onReveal: () => void;
  onMoveTo: () => void;
  onDelete: () => void;
}): ItemAction[] {
  const revealLabel = revealInFolderLabel(window.entropy.platform);

  const actions: ItemAction[] = [
    { label: "Rename", onSelect: options.onRename },
  ];
  if (options.canReference && options.onReference) {
    actions.push({
      label: options.referenceLabel ?? "Reference",
      onSelect: options.onReference,
    });
  }
  actions.push(
    { label: "Copy path", onSelect: options.onCopyPath },
    { label: revealLabel, onSelect: options.onReveal },
    { label: "Move to…", onSelect: options.onMoveTo },
    { label: "Delete", destructive: true, onSelect: options.onDelete },
  );
  return actions;
}
