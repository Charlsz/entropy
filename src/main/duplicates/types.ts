import path from "node:path";
import type { FileEntry } from "../../shared/types";

/** Scanned file metadata — contents are never held in memory. */
export interface ScannedFile {
  path: string;
  name: string;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  /** Filesystem device id (with ino, identifies hard links). */
  dev: number | null;
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
  /** Estimated remaining time in ms once throughput is known; null while warming up. */
  etaMs: number | null;
  /** Human-readable activity line for the live log. */
  logLine?: string;
  /** Newest duplicate group discovered during the scan (streamed). */
  latestGroup?: ExactDuplicateGroup | null;
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
  /** True when the scan stopped early because the file-metadata cap was hit. */
  truncated: boolean;
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
