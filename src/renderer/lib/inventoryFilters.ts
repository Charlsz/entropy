import type { FileEntry } from "../../shared/types";
import { kindFromExtension, type FileKindId } from "../../shared/fileKinds";
import { samePath } from "./platform";

export type InventoryFilterId =
  | "images"
  | "videos"
  | "audio"
  | "documents"
  | "archives"
  | "code"
  | "large"
  | "recentModified"
  | "recentOpened"
  | "referenced"
  | "unreferenced"
  | "duplicates";

export interface InventoryFilterDef {
  id: InventoryFilterId;
  label: string;
  /** Group for UI sections; keeps adding filters cheap later. */
  group: "type" | "activity" | "relationships";
  /** True when the filter needs async relationship data. */
  needsRelations?: boolean;
}

export const INVENTORY_FILTERS: InventoryFilterDef[] = [
  { id: "images", label: "Images", group: "type" },
  { id: "videos", label: "Videos", group: "type" },
  { id: "audio", label: "Audio", group: "type" },
  { id: "documents", label: "Documents", group: "type" },
  { id: "archives", label: "Archives", group: "type" },
  { id: "code", label: "Code", group: "type" },
  { id: "large", label: "Large files", group: "activity" },
  { id: "recentModified", label: "Recently modified", group: "activity" },
  { id: "recentOpened", label: "Recently opened", group: "activity" },
  { id: "referenced", label: "Referenced by notes", group: "relationships", needsRelations: true },
  { id: "unreferenced", label: "Unreferenced", group: "relationships", needsRelations: true },
  { id: "duplicates", label: "Duplicates", group: "relationships", needsRelations: true },
];

export interface EntryRelationFlags {
  noteRefs: number;
  duplicates: number;
}

const LARGE_BYTES = 100 * 1024 * 1024;
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

const TYPE_FILTER_KIND: Partial<Record<InventoryFilterId, FileKindId>> = {
  images: "image",
  videos: "video",
  audio: "audio",
  documents: "document",
  archives: "archive",
  code: "code",
};

/** OR within a group, AND across groups that have active filters. */
export function entryMatchesFilters(
  entry: FileEntry,
  active: Set<InventoryFilterId>,
  recentFiles: string[],
  relations: Record<string, EntryRelationFlags> | null,
): boolean {
  if (active.size === 0) return true;
  if (entry.isDirectory) {
    // Folders stay visible unless a type/relationship filter is active alone.
    const onlyActivity = [...active].every(
      (id) => INVENTORY_FILTERS.find((f) => f.id === id)?.group === "activity",
    );
    return onlyActivity;
  }

  const byGroup = new Map<InventoryFilterDef["group"], InventoryFilterId[]>();
  for (const id of active) {
    const def = INVENTORY_FILTERS.find((item) => item.id === id);
    if (!def) continue;
    const list = byGroup.get(def.group) ?? [];
    list.push(id);
    byGroup.set(def.group, list);
  }

  for (const [group, ids] of byGroup) {
    const pass = ids.some((id) => matchOne(entry, id, recentFiles, relations));
    if (!pass) return false;
    void group;
  }
  return true;
}

function matchOne(
  entry: FileEntry,
  id: InventoryFilterId,
  recentFiles: string[],
  relations: Record<string, EntryRelationFlags> | null,
): boolean {
  const typeKind = TYPE_FILTER_KIND[id];
  if (typeKind) return kindFromExtension(entry.extension) === typeKind;

  if (id === "large") return entry.size >= LARGE_BYTES;
  if (id === "recentModified") return Date.now() - entry.modifiedAt <= RECENT_MS;
  if (id === "recentOpened") return recentFiles.some((path) => samePath(path, entry.path));

  const flags = relations?.[entry.path];
  if (id === "referenced") return (flags?.noteRefs ?? 0) > 0;
  if (id === "unreferenced") return flags != null && flags.noteRefs === 0;
  if (id === "duplicates") return (flags?.duplicates ?? 0) > 0;
  return true;
}

export function filtersNeedRelations(active: Set<InventoryFilterId>): boolean {
  return [...active].some(
    (id) => INVENTORY_FILTERS.find((item) => item.id === id)?.needsRelations,
  );
}
