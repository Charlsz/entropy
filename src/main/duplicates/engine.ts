import {
  DEFAULT_DUPLICATE_SCAN_SCOPE,
  extensionsForScope,
  type DuplicateScanScopeId,
} from "../../shared/duplicateScopes";
import { DuplicateHashCache } from "./cache";
import { chooseHashWorkers } from "./concurrency";
import { fullHash, mapPool, partialHash } from "./hasher";
import { groupBySize, collapseHardLinks, scanFiles } from "./scanner";
import {
  PARTIAL_CHUNK,
  toFileEntry,
  type DuplicateScanProgress,
  type DuplicateScanResult,
  type ExactDuplicateGroup,
  type ScannedFile,
} from "./types";

export type ProgressCallback = (progress: DuplicateScanProgress) => void;

const PROGRESS_MIN_INTERVAL_MS = 120;

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

/**
 * Exact duplicate detection pipeline:
 * scan → size groups → partial BLAKE3 → full BLAKE3 → groups
 *
 * Byte-for-byte verify is deferred to destructive actions (delete), not the listing scan.
 * Extension scopes only limit which files enter the pipeline.
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
  let lastPhase: DuplicateScanProgress["phase"] | "" = "";

  const report = (
    partial: Partial<DuplicateScanProgress> & Pick<DuplicateScanProgress, "phase" | "message">,
    force = false,
  ) => {
    const payload: DuplicateScanProgress = {
      progress: 0,
      filesSeen: 0,
      candidateFiles: 0,
      groupsFound: 0,
      errors: errors.length,
      etaMs: null,
      ...partial,
    };
    const now = Date.now();
    const phaseChanged = payload.phase !== lastPhase;
    const terminal =
      payload.phase === "done" || payload.phase === "cancelled" || payload.phase === "error";
    if (!force && !phaseChanged && !terminal && now - lastSentAt < PROGRESS_MIN_INTERVAL_MS) {
      return;
    }
    lastSentAt = now;
    lastPhase = payload.phase;
    onProgress?.(payload);
  };

  report({
    phase: "scanning",
    progress: 0.02,
    message: extensions ? `Scanning ${scope}…` : "Scanning filesystem…",
  });

  const cache = new DuplicateHashCache(rootPath);
  await cache.load();

  const { files, errors: scanErrors } = await scanFiles(rootPath, {
    signal,
    extensions,
    onFile: (_file, seen) => {
      if (seen % 250 === 0) {
        report({
          phase: "scanning",
          progress: Math.min(0.2, 0.02 + seen / 50_000),
          message: `Scanning… ${seen.toLocaleString()} files`,
          filesSeen: seen,
        });
      }
    },
  });
  errors.push(...scanErrors);

  if (signal?.aborted) {
    return emptyResult(started, errors, files.length);
  }

  report({
    phase: "size",
    progress: 0.22,
    message: `Grouping by size… (${files.length.toLocaleString()} files)`,
    filesSeen: files.length,
  });

  const bySize = groupBySize(collapseHardLinks(files));
  const sizeCandidates: ScannedFile[] = [];
  for (const list of bySize.values()) sizeCandidates.push(...list);
  const workers = chooseHashWorkers(sizeCandidates);

  const partialStarted = Date.now();
  report({
    phase: "partial",
    progress: 0.28,
    message: `Partial hashing ${sizeCandidates.length.toLocaleString()} candidates…`,
    filesSeen: files.length,
    candidateFiles: sizeCandidates.length,
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
        if (partialDone % 8 === 0 || partialDone === sizeCandidates.length) {
          report({
            phase: "partial",
            progress: 0.28 + (0.25 * partialDone) / Math.max(sizeCandidates.length, 1),
            message: `Partial hashing… ${partialDone.toLocaleString()}/${sizeCandidates.length.toLocaleString()}`,
            filesSeen: files.length,
            candidateFiles: sizeCandidates.length,
            errors: errors.length,
            etaMs: etaFromCounts(partialDone, sizeCandidates.length, partialStarted),
          });
        }
      }
    },
    signal,
  );

  if (signal?.aborted) {
    await cache.save();
    return emptyResult(started, errors, files.length);
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
      } catch (err) {
        errors.push({
          path: file.path,
          error: err instanceof Error ? err.message : "Full hash failed",
        });
      } finally {
        fullDone += 1;
        if (fullDone % 4 === 0 || fullDone === partialCandidates.length) {
          report({
            phase: "full",
            progress: 0.55 + (0.4 * fullDone) / Math.max(partialCandidates.length, 1),
            message: `Full hashing… ${fullDone.toLocaleString()}/${partialCandidates.length.toLocaleString()}`,
            filesSeen: files.length,
            candidateFiles: partialCandidates.length,
            errors: errors.length,
            etaMs: etaFromCounts(fullDone, partialCandidates.length, fullStarted),
          });
        }
      }
    },
    signal,
  );

  await cache.save();

  if (signal?.aborted) {
    return emptyResult(started, errors, files.length);
  }

  const groups: ExactDuplicateGroup[] = [];
  for (const [key, list] of byFull) {
    if (list.length < 2) continue;
    const size = list[0].size;
    const hash = key.slice(key.indexOf(":") + 1);
    const copies = list.map(toFileEntry).sort((a, b) => b.modifiedAt - a.modifiedAt);
    groups.push({
      hash,
      size,
      paths: copies.map((c) => c.path),
      copies,
      recoverableBytes: size * (copies.length - 1),
      keepPath: copies[0].path,
    });
  }

  groups.sort((a, b) => b.recoverableBytes - a.recoverableBytes);

  if (signal?.aborted) {
    report(
      {
        phase: "cancelled",
        progress: 1,
        message: "Cancelled",
        filesSeen: files.length,
        groupsFound: groups.length,
        errors: errors.length,
        etaMs: 0,
      },
      true,
    );
  } else {
    report(
      {
        phase: "done",
        progress: 1,
        message:
          groups.length === 0
            ? "No exact duplicates found"
            : `Found ${groups.length.toLocaleString()} duplicate group${groups.length === 1 ? "" : "s"}`,
        filesSeen: files.length,
        candidateFiles: partialCandidates.length,
        groupsFound: groups.length,
        errors: errors.length,
        etaMs: 0,
      },
      true,
    );
  }

  return {
    groups,
    errors,
    filesScanned: files.length,
    durationMs: Date.now() - started,
  };
}

function emptyResult(
  started: number,
  errors: Array<{ path: string; error: string }>,
  filesScanned: number,
): DuplicateScanResult {
  return {
    groups: [],
    errors,
    filesScanned,
    durationMs: Date.now() - started,
  };
}
