import path from "node:path";
import {
  DEFAULT_DUPLICATE_SCAN_SCOPE,
  extensionsForScope,
  type DuplicateScanScopeId,
} from "../../shared/duplicateScopes";
import { isUnsafeReclaimPath } from "../../shared/protectedPaths";
import { DuplicateHashCache } from "./cache";
import { chooseHashWorkers } from "./concurrency";
import { fullHash, mapPool, partialHash } from "./hasher";
import { groupBySize, collapseHardLinks, scanFiles, DEFAULT_MAX_SCAN_FILES } from "./scanner";
import {
  PARTIAL_CHUNK,
  toFileEntry,
  type DuplicateScanProgress,
  type DuplicateScanResult,
  type ExactDuplicateGroup,
  type ScannedFile,
} from "./types";

export type ProgressCallback = (progress: DuplicateScanProgress) => void;

const PROGRESS_MIN_INTERVAL_MS = 80;
const LOG_MIN_INTERVAL_MS = 40;
/** Cap files that proceed to hashing after size-grouping (largest first). */
const MAX_HASH_CANDIDATES = 80_000;

function etaFromCounts(done: number, total: number, phaseStarted: number): number | null {
  if (total <= 0) return null;
  if (done >= total) return 0;
  if (done < 3) return null;
  const elapsed = Date.now() - phaseStarted;
  if (elapsed < 400) return null;
  const rate = done / elapsed;
  if (rate <= 0) return null;
  return Math.round((total - done) / rate);
}

function buildGroup(key: string, list: ScannedFile[]): ExactDuplicateGroup {
  const size = list[0].size;
  const hash = key.slice(key.indexOf(":") + 1);
  const platform = process.platform;
  // Prefer keeping a copy outside tooling/system trees when choosing the survivor.
  const copies = list
    .map(toFileEntry)
    .sort((a, b) => {
      const aUnsafe = isUnsafeReclaimPath(a.path, platform) ? 1 : 0;
      const bUnsafe = isUnsafeReclaimPath(b.path, platform) ? 1 : 0;
      if (aUnsafe !== bUnsafe) return aUnsafe - bUnsafe;
      return b.modifiedAt - a.modifiedAt;
    });
  return {
    hash,
    size,
    paths: copies.map((c) => c.path),
    copies,
    recoverableBytes: size * (copies.length - 1),
    keepPath: copies[0].path,
  };
}

/**
 * Exact duplicate detection pipeline:
 * scan → size groups → partial BLAKE3 → full BLAKE3 → groups
 *
 * Groups stream to the UI as soon as a full-hash bucket has 2+ files.
 */
export async function findExactDuplicates(
  rootPath: string,
  options: {
    signal?: AbortSignal;
    onProgress?: ProgressCallback;
    scope?: DuplicateScanScopeId;
  } = {},
): Promise<DuplicateScanResult> {
  const started = Date.now();
  const errors: Array<{ path: string; error: string }> = [];
  const onProgress = options.onProgress;
  const signal = options.signal;
  const scope = options.scope ?? DEFAULT_DUPLICATE_SCAN_SCOPE;
  const extensions = extensionsForScope(scope);

  let lastSentAt = 0;
  let lastLogAt = 0;
  let lastPhase: DuplicateScanProgress["phase"] | "" = "";
  const streamedKeys = new Set<string>();
  let groupsFound = 0;

  const report = (
    partial: Partial<DuplicateScanProgress> & Pick<DuplicateScanProgress, "phase" | "message">,
    force = false,
  ) => {
    const payload: DuplicateScanProgress = {
      progress: 0,
      filesSeen: 0,
      candidateFiles: 0,
      groupsFound,
      errors: errors.length,
      etaMs: null,
      latestGroup: null,
      ...partial,
    };
    const now = Date.now();
    const phaseChanged = payload.phase !== lastPhase;
    const terminal =
      payload.phase === "done" || payload.phase === "cancelled" || payload.phase === "error";
    const hasGroup = Boolean(payload.latestGroup);
    const hasLog = Boolean(payload.logLine);
    if (hasLog && !force && !hasGroup && !phaseChanged && !terminal) {
      if (now - lastLogAt < LOG_MIN_INTERVAL_MS) {
        // Keep the latest line; drop only if we're flooding faster than ~25Hz.
        return;
      }
    } else if (
      !force &&
      !phaseChanged &&
      !terminal &&
      !hasGroup &&
      !hasLog &&
      now - lastSentAt < PROGRESS_MIN_INTERVAL_MS
    ) {
      return;
    }
    lastSentAt = now;
    if (hasLog) lastLogAt = now;
    lastPhase = payload.phase;
    onProgress?.(payload);
  };

  report({
    phase: "scanning",
    progress: 0.02,
    message: extensions ? `Scanning ${scope}…` : "Scanning filesystem…",
    logLine: extensions
      ? `Started ${scope} scan under ${path.basename(rootPath) || rootPath}`
      : `Started full scan under ${path.basename(rootPath) || rootPath}`,
  });

  const cache = new DuplicateHashCache(rootPath);
  await cache.load();

  const { files, errors: scanErrors, truncated: listingTruncated } = await scanFiles(rootPath, {
    signal,
    extensions,
    maxFiles: DEFAULT_MAX_SCAN_FILES,
    onFile: (file, seen) => {
      if (seen <= 8 || seen % 5 === 0) {
        report({
          phase: "scanning",
          progress: Math.min(0.2, 0.02 + seen / 50_000),
          message: `Scanning… ${seen.toLocaleString()} files`,
          filesSeen: seen,
          logLine:
            seen <= 8
              ? `Found ${file.name}`
              : `Indexed ${seen.toLocaleString()} files…`,
        });
      }
    },
  });
  errors.push(...scanErrors);
  let truncated = listingTruncated;

  if (signal?.aborted) {
    return emptyResult(started, errors, files.length, truncated);
  }

  if (truncated) {
    report({
      phase: "scanning",
      progress: 0.2,
      message: `Scan capped at ${DEFAULT_MAX_SCAN_FILES.toLocaleString()} files`,
      filesSeen: files.length,
      logLine: `Reached the ${DEFAULT_MAX_SCAN_FILES.toLocaleString()}-file safety cap — continuing with this sample`,
    }, true);
  }

  report({
    phase: "size",
    progress: 0.22,
    message: `Grouping by size… (${files.length.toLocaleString()} files)`,
    filesSeen: files.length,
    logLine: `Finished listing ${files.length.toLocaleString()} files — grouping by size`,
  });

  const bySize = groupBySize(collapseHardLinks(files));
  let sizeCandidates: ScannedFile[] = [];
  for (const list of bySize.values()) sizeCandidates.push(...list);

  if (sizeCandidates.length > MAX_HASH_CANDIDATES) {
    sizeCandidates.sort((a, b) => b.size - a.size);
    sizeCandidates = sizeCandidates.slice(0, MAX_HASH_CANDIDATES);
    truncated = true;
    report({
      phase: "size",
      progress: 0.24,
      message: `Hashing largest ${MAX_HASH_CANDIDATES.toLocaleString()} of size-matched files…`,
      filesSeen: files.length,
      candidateFiles: sizeCandidates.length,
      logLine: `Too many size matches — focusing on the ${MAX_HASH_CANDIDATES.toLocaleString()} largest candidates`,
    }, true);
  }

  const workers = chooseHashWorkers(sizeCandidates);

  const partialStarted = Date.now();
  report({
    phase: "partial",
    progress: 0.28,
    message: `Partial hashing ${sizeCandidates.length.toLocaleString()} candidates…`,
    filesSeen: files.length,
    candidateFiles: sizeCandidates.length,
    logLine: `${sizeCandidates.length.toLocaleString()} size matches — partial hashing`,
  });

  const byPartial = new Map<string, ScannedFile[]>();
  let partialDone = 0;

  await mapPool(
    sizeCandidates,
    workers,
    async (file) => {
      if (signal?.aborted) return;
      try {
        const cached = cache.get(file.path, file.size, file.mtimeMs, file.ino);
        let partial = cached?.partialHash ?? null;
        const tiny = file.size <= PARTIAL_CHUNK * 3;
        if (!partial) {
          partial = await partialHash(file.path, file.size);
          cache.set({
            path: file.path,
            size: file.size,
            mtimeMs: file.mtimeMs,
            ino: file.ino,
            partialHash: partial,
            fullHash: tiny ? partial : (cached?.fullHash ?? null),
            updatedAt: Date.now(),
          });
        } else if (tiny && !cached?.fullHash) {
          cache.set({
            path: file.path,
            size: file.size,
            mtimeMs: file.mtimeMs,
            ino: file.ino,
            partialHash: partial,
            fullHash: partial,
            updatedAt: Date.now(),
          });
        }
        const key = `${file.size}:${partial}`;
        const list = byPartial.get(key) ?? [];
        list.push(file);
        byPartial.set(key, list);
      } catch (err) {
        errors.push({
          path: file.path,
          error: err instanceof Error ? err.message : "Partial hash failed",
        });
      } finally {
        partialDone += 1;
        if (partialDone % 2 === 0 || partialDone === sizeCandidates.length) {
          report({
            phase: "partial",
            progress: 0.28 + (0.25 * partialDone) / Math.max(sizeCandidates.length, 1),
            message: `Partial hashing… ${partialDone.toLocaleString()}/${sizeCandidates.length.toLocaleString()}`,
            filesSeen: files.length,
            candidateFiles: sizeCandidates.length,
            errors: errors.length,
            etaMs: etaFromCounts(partialDone, sizeCandidates.length, partialStarted),
            logLine: `Checking ${file.name}`,
          });
        }
      }
    },
    signal,
  );

  if (signal?.aborted) {
    await cache.save();
    return emptyResult(started, errors, files.length, truncated);
  }

  const partialCandidates: ScannedFile[] = [];
  for (const list of byPartial.values()) {
    if (list.length >= 2) partialCandidates.push(...list);
  }

  const fullStarted = Date.now();
  report({
    phase: "full",
    progress: 0.55,
    message: `Full hashing ${partialCandidates.length.toLocaleString()} candidates…`,
    filesSeen: files.length,
    candidateFiles: partialCandidates.length,
    errors: errors.length,
    logLine: `${partialCandidates.length.toLocaleString()} candidates — confirming identical contents`,
  });

  const byFull = new Map<string, ScannedFile[]>();
  let fullDone = 0;

  await mapPool(
    partialCandidates,
    workers,
    async (file) => {
      if (signal?.aborted) return;
      try {
        const cached = cache.get(file.path, file.size, file.mtimeMs, file.ino);
        let full = cached?.fullHash ?? null;
        if (!full) {
          full = await fullHash(file.path);
          cache.set({
            path: file.path,
            size: file.size,
            mtimeMs: file.mtimeMs,
            ino: file.ino,
            partialHash: cached?.partialHash ?? null,
            fullHash: full,
            updatedAt: Date.now(),
          });
        }
        const key = `${file.size}:${full}`;
        const list = byFull.get(key) ?? [];
        list.push(file);
        byFull.set(key, list);

        if (list.length >= 2) {
          const group = buildGroup(key, list);
          const isNew = !streamedKeys.has(key);
          if (isNew) {
            streamedKeys.add(key);
            groupsFound += 1;
          }
          report(
            {
              phase: "full",
              progress: 0.55 + (0.4 * (fullDone + 1)) / Math.max(partialCandidates.length, 1),
              message: `Found ${groupsFound.toLocaleString()} duplicate group${groupsFound === 1 ? "" : "s"}…`,
              filesSeen: files.length,
              candidateFiles: partialCandidates.length,
              errors: errors.length,
              groupsFound,
              latestGroup: group,
              logLine: isNew
                ? `Found ${group.copies.length} copies of ${group.copies[0].name}`
                : `Updated ${group.copies[0].name} — now ${group.copies.length} copies`,
            },
            true,
          );
        }
      } catch (err) {
        errors.push({
          path: file.path,
          error: err instanceof Error ? err.message : "Full hash failed",
        });
      } finally {
        fullDone += 1;
        if (fullDone % 1 === 0 || fullDone === partialCandidates.length) {
          report({
            phase: "full",
            progress: 0.55 + (0.4 * fullDone) / Math.max(partialCandidates.length, 1),
            message: `Full hashing… ${fullDone.toLocaleString()}/${partialCandidates.length.toLocaleString()}`,
            filesSeen: files.length,
            candidateFiles: partialCandidates.length,
            errors: errors.length,
            groupsFound,
            etaMs: etaFromCounts(fullDone, partialCandidates.length, fullStarted),
            logLine: `Confirming ${file.name}`,
          });
        }
      }
    },
    signal,
  );

  await cache.save();

  const groups: ExactDuplicateGroup[] = [];
  for (const [key, list] of byFull) {
    if (list.length < 2) continue;
    groups.push(buildGroup(key, list));
  }
  groups.sort((a, b) => b.recoverableBytes - a.recoverableBytes);
  groupsFound = groups.length;

  if (signal?.aborted) {
    report(
      {
        phase: "cancelled",
        progress: 1,
        message: "Cancelled",
        filesSeen: files.length,
        groupsFound,
        errors: errors.length,
        etaMs: 0,
        logLine: "Scan cancelled",
      },
      true,
    );
    return {
      groups,
      errors,
      filesScanned: files.length,
      durationMs: Date.now() - started,
      truncated,
    };
  }

  const doneMessage =
    groups.length === 0
      ? truncated
        ? "No exact duplicates in the capped sample"
        : "No exact duplicates found"
      : `Found ${groups.length.toLocaleString()} duplicate group${groups.length === 1 ? "" : "s"}`;

  report(
    {
      phase: "done",
      progress: 1,
      message: doneMessage,
      filesSeen: files.length,
      candidateFiles: partialCandidates.length,
      groupsFound,
      errors: errors.length,
      etaMs: 0,
      logLine: truncated
        ? groups.length === 0
          ? "Done — capped sample, no exact duplicates"
          : `Done — ${groups.length.toLocaleString()} groups (scan was capped for memory)`
        : groups.length === 0
          ? "Done — no exact duplicates"
          : `Done — ${groups.length.toLocaleString()} groups`,
    },
    true,
  );

  return {
    groups,
    errors,
    filesScanned: files.length,
    durationMs: Date.now() - started,
    truncated,
  };
}

function emptyResult(
  started: number,
  errors: Array<{ path: string; error: string }>,
  filesScanned: number,
  truncated = false,
): DuplicateScanResult {
  return {
    groups: [],
    errors,
    filesScanned,
    durationMs: Date.now() - started,
    truncated,
  };
}
