export type FileKindId =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "executable"
  | "other";

const IMAGE = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif", ".heic", ".tif", ".tiff", ".ico"]);
const VIDEO = new Set([".mp4", ".webm", ".ogg", ".mov", ".mkv", ".m4v", ".avi", ".wmv"]);
const AUDIO = new Set([".mp3", ".wav", ".m4a", ".flac", ".aac", ".wma", ".aiff", ".opus"]);
const DOCUMENT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".rtf",
  ".md",
  ".csv",
  ".pages",
  ".numbers",
  ".key",
  ".epub",
]);
const ARCHIVE = new Set([".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".iso", ".dmg"]);
const CODE = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".scss",
  ".html",
  ".xml",
  ".yml",
  ".yaml",
  ".toml",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".cs",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".sql",
  ".sh",
  ".ps1",
]);
const EXECUTABLE = new Set([".exe", ".msi", ".app", ".dmg", ".bat", ".cmd", ".com", ".dll", ".so", ".dylib"]);

/** Muted fills aligned with Entropy's dark UI — distinct kinds, not neon. */
export const FILE_KIND_FILL: Record<FileKindId, string> = {
  image: "#3d4a52",
  video: "#4a3f46",
  audio: "#3f4a40",
  document: "#4a453a",
  archive: "#453f4a",
  code: "#3a4548",
  executable: "#4a4038",
  other: "#3a3a3e",
};

export const FILE_KIND_LABEL: Record<FileKindId, string> = {
  image: "Images",
  video: "Video",
  audio: "Audio",
  document: "Documents",
  archive: "Archives",
  code: "Code",
  executable: "Apps",
  other: "Other",
};

export const FILE_KIND_ORDER: FileKindId[] = [
  "image",
  "video",
  "audio",
  "document",
  "archive",
  "code",
  "executable",
  "other",
];

export function kindFromExtension(extension: string): FileKindId {
  const ext = extension.toLowerCase();
  if (IMAGE.has(ext)) return "image";
  if (VIDEO.has(ext)) return "video";
  if (AUDIO.has(ext)) return "audio";
  if (DOCUMENT.has(ext)) return "document";
  if (ARCHIVE.has(ext)) return "archive";
  if (CODE.has(ext)) return "code";
  if (EXECUTABLE.has(ext)) return "executable";
  return "other";
}
