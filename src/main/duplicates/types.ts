import path from "node:path";
import type { FileEntry } from "../../shared/types";

/** Scanned file metadata — contents are never held in memory. */
export interface ScannedFile {
  path: string;
  name: string;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  ino: number | null;
  extension: string;
}

export interface HashCacheRecord {
  path: string;
  size: number;
  mtimeMs: number;
  ino: number | null;
  partialHash: string | null;
  fullHash: string | null;
  updatedAt: number;
}

export type DuplicateScanPhase =
  | "scanning"
  | "size"
  | "partial"
  | "full"
  | "verify"
  | "done"
  | "cancelled"
  | "error";

export interface DuplicateScanProgress {
  phase: DuplicateScanPhase;
  /** 0–1 overall estimate. */
  progress: number;
  message: string;
  filesSeen: number;
  candidateFiles: number;
  groupsFound: number;
  errors: number;
}

export interface ExactDuplicateGroup {
  hash: string;
  size: number;
  paths: string[];
  copies: FileEntry[];
  recoverableBytes: number;
  keepPath: string;
}

export interface DuplicateScanResult {
  groups: ExactDuplicateGroup[];
  errors: Array<{ path: string; error: string }>;
  filesScanned: number;
  durationMs: number;
}

export function toFileEntry(file: ScannedFile): FileEntry {
  return {
    name: file.name,
    path: file.path,
    isDirectory: false,
    size: file.size,
    modifiedAt: file.mtimeMs,
    extension: file.extension || path.extname(file.name).toLowerCase(),
  };
}

export const PARTIAL_CHUNK = 64 * 1024;
export const HASH_BUFFER = 1024 * 1024;
