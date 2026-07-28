const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".mkv", ".m4v"]);

export type MediaKind = "image" | "video" | "other";

export function mediaKind(extension: string): MediaKind {
  const ext = extension.toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return "other";
}

export function isMediaEntry(entry: { isDirectory: boolean; extension: string }): boolean {
  return !entry.isDirectory && mediaKind(entry.extension) !== "other";
}
