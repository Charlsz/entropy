import type { FileEntry } from "../../shared/types";

export type NoteTreeFolder = {
  type: "folder";
  name: string;
  /** Absolute folder path. */
  path: string;
  children: NoteTreeNode[];
};

export type NoteTreeNote = {
  type: "note";
  name: string;
  path: string;
  modifiedAt: number;
};

export type NoteTreeNode = NoteTreeFolder | NoteTreeNote;

type MutableFolder = {
  type: "folder";
  name: string;
  path: string;
  folders: Map<string, MutableFolder>;
  notes: NoteTreeNote[];
};

/**
 * Build a folder tree of Markdown notes under `workspaceRoot`.
 * Only folders that contain notes (directly or nested) appear.
 */
export function buildNoteFolderTree(
  notes: FileEntry[],
  workspaceRoot: string,
): NoteTreeNode[] {
  const rootNorm = workspaceRoot.replace(/[/\\]+$/, "");

  const root: MutableFolder = {
    type: "folder",
    name: "",
    path: rootNorm,
    folders: new Map(),
    notes: [],
  };

  for (const note of notes) {
    if (note.isDirectory) continue;
    const notePath = note.path.replace(/[/\\]+$/, "");
    const relative = relativePathSegments(rootNorm, notePath);
    if (relative === null) continue;

    let cursor = root;
    for (let i = 0; i < relative.length - 1; i += 1) {
      const segment = relative[i]!;
      let next = cursor.folders.get(segment.toLowerCase());
      if (!next) {
        const parentPath = cursor.path;
        const childPath = joinPath(parentPath, segment, note.path);
        next = {
          type: "folder",
          name: segment,
          path: childPath,
          folders: new Map(),
          notes: [],
        };
        cursor.folders.set(segment.toLowerCase(), next);
      }
      cursor = next;
    }

    cursor.notes.push({
      type: "note",
      name: note.name,
      path: note.path,
      modifiedAt: note.modifiedAt,
    });
  }

  return finalizeFolder(root);
}

function finalizeFolder(folder: MutableFolder): NoteTreeNode[] {
  const folders = [...folder.folders.values()]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .map(
      (child): NoteTreeFolder => ({
        type: "folder",
        name: child.name,
        path: child.path,
        children: finalizeFolder(child),
      }),
    );

  const notes = [...folder.notes].sort((a, b) => {
    if (b.modifiedAt !== a.modifiedAt) return b.modifiedAt - a.modifiedAt;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return [...folders, ...notes];
}

/** Relative path segments from root to file, or null if not under root. */
function relativePathSegments(rootPath: string, filePath: string): string[] | null {
  const root = rootPath.replace(/[/\\]+$/, "").replace(/\\/g, "/");
  const file = filePath.replace(/[/\\]+$/, "").replace(/\\/g, "/");
  const rootKey = root.toLowerCase();
  const fileKey = file.toLowerCase();

  if (fileKey === rootKey) return null;
  const prefix = rootKey.endsWith("/") ? rootKey : `${rootKey}/`;
  if (!fileKey.startsWith(prefix)) return null;

  // Preserve original casing from the file path slice.
  const sliceStart = root.length + (file.charAt(root.length) === "/" ? 1 : 0);
  const relative = file.slice(sliceStart);
  const parts = relative.split("/").filter(Boolean);
  return parts.length > 0 ? parts : null;
}

function joinPath(parent: string, segment: string, samplePath: string): string {
  const sep = samplePath.includes("\\") ? "\\" : "/";
  const trimmed = parent.replace(/[/\\]+$/, "");
  return `${trimmed}${sep}${segment}`;
}

/** Absolute folder paths from workspace root down to the note’s parent. */
export function noteAncestorFolders(
  workspaceRoot: string,
  notePath: string,
): string[] {
  const segments = relativePathSegments(workspaceRoot, notePath);
  if (!segments || segments.length <= 1) return [];

  const sample = notePath;
  const sep = sample.includes("\\") ? "\\" : "/";
  const root = workspaceRoot.replace(/[/\\]+$/, "");
  const folders: string[] = [];
  let cursor = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    cursor = `${cursor}${sep}${segments[i]}`;
    folders.push(cursor);
  }
  return folders;
}

export function parentDirOfNote(notePath: string, workspaceRoot: string): string {
  const normalized = notePath.replace(/[/\\]+$/, "");
  const idxForward = normalized.lastIndexOf("/");
  const idxBack = normalized.lastIndexOf("\\");
  const idx = Math.max(idxForward, idxBack);
  if (idx <= 0) return workspaceRoot;
  return normalized.slice(0, idx) || workspaceRoot;
}
