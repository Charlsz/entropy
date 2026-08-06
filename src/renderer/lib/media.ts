const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".avif",
  ".heic",
  ".tif",
  ".tiff",
  ".ico",
]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".mkv", ".m4v", ".avi", ".wmv"]);
const PDF_EXT = new Set([".pdf"]);

export type MediaKind = "image" | "video" | "pdf" | "other";

export function mediaKind(extension: string): MediaKind {
  const ext = extension.toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (PDF_EXT.has(ext)) return "pdf";
  return "other";
}

/** Visual/media faces for grid cards (images, video, PDF). */
export function isPreviewableEntry(entry: {
  isDirectory: boolean;
  extension: string;
}): boolean {
  return !entry.isDirectory && mediaKind(entry.extension) !== "other";
}

/** Folder collage still prefers image/video faces over PDF iframes. */
export function isMediaEntry(entry: { isDirectory: boolean; extension: string }): boolean {
  if (entry.isDirectory) return false;
  const kind = mediaKind(entry.extension);
  return kind === "image" || kind === "video";
}
