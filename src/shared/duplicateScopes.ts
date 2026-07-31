/** Extension scopes for exact-duplicate scans. Filtering only; matching stays byte-identical. */

export type DuplicateScanScopeId =
  | "full"
  | "documents"
  | "images"
  | "media"
  | "archives";

export interface DuplicateScanScope {
  id: DuplicateScanScopeId;
  label: string;
  /** null = all extensions. Lowercase with leading dot. */
  extensions: readonly string[] | null;
}

export const DUPLICATE_SCAN_SCOPES: readonly DuplicateScanScope[] = [
  {
    id: "images",
    label: "Images",
    extensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".svg",
      ".webp",
      ".bmp",
      ".tif",
      ".tiff",
      ".heic",
      ".heif",
      ".ico",
    ],
  },
  {
    id: "documents",
    label: "Documents",
    extensions: [
      ".pdf",
      ".txt",
      ".md",
      ".docx",
      ".doc",
      ".xlsx",
      ".xls",
      ".pptx",
      ".ppt",
      ".rtf",
      ".csv",
      ".odt",
      ".ods",
    ],
  },
  {
    id: "media",
    label: "Video & audio",
    extensions: [
      ".mp4",
      ".mov",
      ".mkv",
      ".avi",
      ".webm",
      ".m4v",
      ".wmv",
      ".mp3",
      ".wav",
      ".flac",
      ".aac",
      ".m4a",
      ".ogg",
      ".wma",
    ],
  },
  {
    id: "archives",
    label: "Archives & apps",
    extensions: [
      ".zip",
      ".rar",
      ".7z",
      ".tar",
      ".gz",
      ".tgz",
      ".exe",
      ".dmg",
      ".msi",
      ".iso",
      ".pkg",
      ".appx",
    ],
  },
  {
    id: "full",
    label: "All files",
    extensions: null,
  },
] as const;

/** Prefer a scoped scan by default — full trees are slower on weak disks. */
export const DEFAULT_DUPLICATE_SCAN_SCOPE: DuplicateScanScopeId = "images";

export function extensionsForScope(scopeId: DuplicateScanScopeId): ReadonlySet<string> | null {
  const scope = DUPLICATE_SCAN_SCOPES.find((item) => item.id === scopeId);
  if (!scope || scope.extensions === null) return null;
  return new Set(scope.extensions);
}

export interface DuplicateScanRequest {
  rootPath: string;
  scope?: DuplicateScanScopeId;
}
