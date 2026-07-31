import { cpus } from "node:os";
import type { ScannedFile } from "./types";

const LARGE_FILE = 32 * 1024 * 1024;

/**
 * Prefer serial/low concurrency on weak disks.
 * Large average candidates → 1 worker (HDD-friendly sequential reads).
 * Otherwise at most 2 workers — parallel hashing thrashes mechanical drives.
 */
export function chooseHashWorkers(candidates: ScannedFile[]): number {
  const cpu = Math.max(1, cpus().length || 2);
  if (candidates.length === 0) return 1;

  let total = 0;
  for (const file of candidates) total += file.size;
  const avg = total / candidates.length;

  if (avg >= LARGE_FILE) return 1;
  return Math.max(1, Math.min(2, cpu));
}
