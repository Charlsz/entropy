/** Library content perspectives. */
export type LibraryPerspective =
  | "folders"
  | "gallery"
  | "large-files"
  | "duplicates"
  | "recent";

export const PERSPECTIVE_LABELS: Record<LibraryPerspective, string> = {
  folders: "Folders",
  gallery: "Gallery",
  "large-files": "Large Files",
  duplicates: "Duplicates",
  recent: "Recent",
};

/** Files larger than this belong in Large Files perspective. */
export const LARGE_FILE_BYTES = 100 * 1024 * 1024;
