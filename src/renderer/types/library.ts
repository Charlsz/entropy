/** Library content perspectives. */
export type LibraryPerspective =
  | "folders"
  | "gallery"
  | "large-files"
  | "duplicates";

/** Optional Intelligence destinations (may be coming-soon stubs). */
export type IntelligenceView = "relationships" | "copilot";

export const LIBRARY_PERSPECTIVES: LibraryPerspective[] = [
  "folders",
  "gallery",
  "large-files",
  "duplicates",
];

export const PERSPECTIVE_LABELS: Record<LibraryPerspective, string> = {
  folders: "Folders",
  gallery: "Gallery",
  "large-files": "Large Files",
  duplicates: "Duplicates",
};

/** Files larger than this belong in Large Files perspective. */
export const LARGE_FILE_BYTES = 100 * 1024 * 1024;
