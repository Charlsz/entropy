import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, FolderOpen, Square } from "lucide-react";
import type {
  DuplicateGroup,
  DuplicateScanProgress,
  DuplicateScanResult,
} from "../../shared/types";
import {
  DEFAULT_DUPLICATE_SCAN_SCOPE,
  DUPLICATE_SCAN_SCOPES,
  type DuplicateScanScopeId,
} from "../../shared/duplicateScopes";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { ConfirmDialog, DeletePreviewLists } from "./ConfirmDialog";
import { TrashUndoBar } from "./TrashUndoBar";
import { cn } from "../lib/utils";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatEta(ms: number | null | undefined): string | null {
  if (ms == null || ms < 0) return null;
  if (ms < 1000) return "<1s left";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `~${seconds}s left`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem === 0 ? `~${minutes}m left` : `~${minutes}m ${rem}s left`;
}

function baseName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}

interface InventoryDuplicatesPanelProps {
  rootPath: string;
  onBack: () => void;
}

type Phase = "choose" | "running" | "done";

/**
 * Inventory feature surface: replaces gallery + treemap content while active.
 * Scope is chosen before any scan work starts.
 */
export function InventoryDuplicatesPanel({ rootPath, onBack }: InventoryDuplicatesPanelProps) {
  const [scope, setScope] = useState<DuplicateScanScopeId>(DEFAULT_DUPLICATE_SCAN_SCOPE);
  const [phase, setPhase] = useState<Phase>("choose");
  const [activeScope, setActiveScope] = useState<DuplicateScanScopeId | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [progress, setProgress] = useState<DuplicateScanProgress | null>(null);
  const [result, setResult] = useState<DuplicateScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Paths marked for trash (copies). Keep paths stay out. */
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [undoBatch, setUndoBatch] = useState<{ paths: string[]; reclaimBytes: number } | null>(
    null,
  );
  const [undoBusy, setUndoBusy] = useState(false);

  useEffect(() => {
    return window.entropy.duplicates.onProgress(setProgress);
  }, []);

  useEffect(() => {
    if (phase !== "running" || !rootPath || !activeScope) return;
    let cancelled = false;
    setError(null);
    setResult(null);
    setProgress(null);
    void window.entropy.duplicates
      .scan(rootPath, { scope: activeScope })
      .then((next) => {
        if (!cancelled) {
          setResult(next);
          setSelectedForDelete(defaultDeleteSelection(next.groups));
          setPhase("done");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Scan failed");
          setPhase("choose");
        }
      });
    return () => {
      cancelled = true;
      void window.entropy.duplicates.cancel();
    };
  }, [phase, rootPath, activeScope, scanKey]);

  function startScan(): void {
    setActiveScope(scope);
    setPhase("running");
    setScanKey((key) => key + 1);
  }

  function stopScan(): void {
    void window.entropy.duplicates.cancel();
    setPhase("choose");
    setProgress(null);
  }

  const running = phase === "running";
  const groups: DuplicateGroup[] = result?.groups ?? [];
  const sizeByPath = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of groups) {
      for (const copy of group.copies) map.set(copy.path, group.size);
    }
    return map;
  }, [groups]);

  const deletePaths = useMemo(
    () => [...selectedForDelete].filter((path) => sizeByPath.has(path)),
    [selectedForDelete, sizeByPath],
  );
  const reclaimBytes = useMemo(
    () => deletePaths.reduce((sum, path) => sum + (sizeByPath.get(path) ?? 0), 0),
    [deletePaths, sizeByPath],
  );
  const keepingNames = useMemo(() => {
    const names: string[] = [];
    for (const group of groups) {
      if (group.copies.some((copy) => selectedForDelete.has(copy.path))) {
        const keep = group.copies.find((copy) => !selectedForDelete.has(copy.path));
        if (keep) names.push(baseName(keep.path));
      }
    }
    return names;
  }, [groups, selectedForDelete]);

  const percent = Math.round((progress?.progress ?? (running ? 0.05 : result ? 1 : 0)) * 100);
  const etaLabel = running ? formatEta(progress?.etaMs) : null;
  const scopeLabel =
    DUPLICATE_SCAN_SCOPES.find((item) => item.id === (activeScope ?? scope))?.label ?? "Images";

  function toggleDelete(path: string, group: DuplicateGroup): void {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        return next;
      }
      // Never mark every copy — leave at least one.
      const othersSelected = group.copies.filter((c) => c.path !== path && next.has(c.path)).length;
      const remaining = group.copies.length - othersSelected - 1;
      if (remaining < 1 && othersSelected === group.copies.length - 1) {
        return prev;
      }
      next.add(path);
      // If this was the only unselected (keep), ensure another stay unselected.
      const unselected = group.copies.filter((c) => !next.has(c.path));
      if (unselected.length === 0) {
        const fallback = group.copies.find((c) => c.path !== path) ?? group.copies[0];
        next.delete(fallback.path);
      }
      return next;
    });
  }

  async function confirmCleanup(): Promise<void> {
    if (deletePaths.length === 0) return;
    setDeleting(true);
    setError(null);
    const batch = [...deletePaths];
    const batchReclaim = reclaimBytes;
    try {
      for (const path of batch) {
        await window.entropy.fs.remove(path);
      }
      setUndoBatch({ paths: batch, reclaimBytes: batchReclaim });
      setResult((prev) => {
        if (!prev) return prev;
        const removed = new Set(batch);
        const nextGroups: DuplicateGroup[] = [];
        for (const group of prev.groups) {
          const copies = group.copies.filter((copy) => !removed.has(copy.path));
          if (copies.length < 2) continue;
          nextGroups.push({
            hash: group.hash,
            size: group.size,
            copies,
            recoverableBytes: group.size * (copies.length - 1),
            keepPath: copies.find((c) => c.path === group.keepPath)?.path ?? copies[0].path,
          });
        }
        return { ...prev, groups: nextGroups };
      });
      setSelectedForDelete(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move files to Trash");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  async function undoCleanup(): Promise<void> {
    if (!undoBatch) return;
    setUndoBusy(true);
    setError(null);
    try {
      const result = await window.entropy.fs.undoRemove(undoBatch.paths);
      if (result.failed.length > 0 && result.restored === 0) {
        setError("Could not restore automatically — open Trash to recover files.");
      } else {
        setUndoBatch(null);
        // Rescan would be heavy; nudge user to Change scope / Rescan via staying on done with stale groups.
        // Soft approach: clear results so they re-scan if needed, or reload listing by re-running scan.
        setPhase("choose");
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setUndoBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" aria-label="Duplicate files">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Back to folder"
          onClick={() => {
            if (running) void window.entropy.duplicates.cancel();
            onBack();
          }}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <p className="truncate text-sm font-medium text-foreground">Exact duplicates</p>
          </div>
          <p className="truncate text-sm text-muted-foreground" title={rootPath}>
            {rootPath}
          </p>
        </div>
        {running ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2 text-xs"
            onClick={stopScan}
          >
            <Square className="h-3 w-3" strokeWidth={1.75} />
            Stop
          </Button>
        ) : phase === "done" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={() => {
              setResult(null);
              setProgress(null);
              setError(null);
              setSelectedForDelete(new Set());
              setPhase("choose");
            }}
          >
            Change scope
          </Button>
        ) : null}
      </div>

      {phase === "choose" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-1 text-center">
              <h2 className="text-sm font-medium text-foreground">What should we scan?</h2>
              <p className="text-sm text-muted-foreground">
                Pick a scope first. Nothing is hashed until you start.
              </p>
            </div>
            <div className="grid gap-2">
              {DUPLICATE_SCAN_SCOPES.map((item) => {
                const selected = scope === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-colors duration-150",
                      selected
                        ? "border-paper-2 bg-ink-2 text-foreground"
                        : "border-border text-muted-foreground hover:border-paper-2/40 hover:text-foreground",
                    )}
                    onClick={() => setScope(item.id)}
                  >
                    <span className="block text-sm font-medium text-foreground">{item.label}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {item.extensions
                        ? item.extensions.slice(0, 6).join(" ") +
                          (item.extensions.length > 6 ? "…" : "")
                        : "Every file under this location"}
                    </span>
                  </button>
                );
              })}
            </div>
            {error ? <p className="text-center text-sm text-muted-foreground">{error}</p> : null}
            <Button type="button" className="h-9 w-full" disabled={!rootPath} onClick={startScan}>
              Scan {DUPLICATE_SCAN_SCOPES.find((item) => item.id === scope)?.label ?? "files"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">
                {progress?.message ??
                  (running ? `Scanning ${scopeLabel}…` : error ? error : "Ready")}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {etaLabel ? `${etaLabel} · ` : ""}
                {percent}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-2">
              <div className="h-full rounded-full bg-paper-2" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Exact duplicates only · scope {scopeLabel}
            </p>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 p-4 pb-28">
              {!running && !error && groups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
                  <p className="text-sm text-foreground">No exact duplicates found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try another scope, or every matching file under this location is unique.
                  </p>
                </div>
              ) : null}

              {groups.map((group) => (
                <article
                  key={`${group.hash}-${group.size}`}
                  className="rounded-xl border border-border bg-ink-2 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <h2 className="text-sm font-medium text-foreground">
                        {group.copies.length} copies · {formatBytes(group.size)} each
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Exact duplicate · identical contents
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Recover {formatBytes(group.recoverableBytes)}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {group.copies.map((copy) => {
                      const marked = selectedForDelete.has(copy.path);
                      const isKeep = !marked;
                      return (
                        <li key={copy.path} className="flex items-center gap-2 text-sm">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 shrink-0 rounded border-border bg-background accent-paper"
                              checked={marked}
                              disabled={phase !== "done" || deleting}
                              onChange={() => toggleDelete(copy.path, group)}
                              aria-label={
                                marked
                                  ? `Delete ${baseName(copy.path)}`
                                  : `Keep ${baseName(copy.path)}`
                              }
                            />
                            <span
                              className={cn(
                                "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                                isKeep ? "bg-background text-foreground" : "text-muted-foreground",
                              )}
                            >
                              {isKeep ? "Keep" : "Delete"}
                            </span>
                            <span
                              className="min-w-0 flex-1 truncate text-left text-muted-foreground"
                              title={copy.path}
                            >
                              {copy.path}
                            </span>
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            aria-label="Reveal in folder"
                            onClick={() => void window.entropy.fs.reveal(copy.path)}
                          >
                            <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </ScrollArea>

          <div className="flex shrink-0 flex-col gap-0 border-t border-border">
            {undoBatch ? (
              <TrashUndoBar
                fileCount={undoBatch.paths.length}
                reclaimLabel={formatBytes(undoBatch.reclaimBytes)}
                busy={undoBusy}
                onUndo={() => void undoCleanup()}
                onOpenTrash={() => void window.entropy.fs.openTrash()}
                onDismiss={() => setUndoBatch(null)}
              />
            ) : null}
            <div className="flex flex-col gap-2 px-4 py-3">
            {deletePaths.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">
                    Delete {deletePaths.length.toLocaleString()} file
                    {deletePaths.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-muted-foreground">Reclaim {formatBytes(reclaimBytes)}</p>
                </div>
                <Button
                  type="button"
                  className="h-8 shrink-0 px-3 text-xs"
                  disabled={deleting}
                  onClick={() => setConfirmOpen(true)}
                >
                  Review delete
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span className="min-w-0 truncate">
                  {result
                    ? `${result.filesScanned.toLocaleString()} files · ${formatDuration(result.durationMs)}`
                    : progress
                      ? `${progress.filesSeen.toLocaleString()} seen`
                      : rootPath}
                </span>
                <span className="shrink-0">
                  {groups.length > 0
                    ? `${groups.length} groups · select copies to reclaim`
                    : ""}
                </span>
              </div>
            )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${deletePaths.length.toLocaleString()} file${deletePaths.length === 1 ? "" : "s"}?`}
        confirmLabel="Move to Trash"
        onConfirm={() => void confirmCleanup()}
        onOpenChange={setConfirmOpen}
        description={
          <DeletePreviewLists
            deleting={deletePaths.map(baseName)}
            keeping={keepingNames}
            reclaimLabel={formatBytes(reclaimBytes)}
          />
        }
      />
    </div>
  );
}

function defaultDeleteSelection(groups: DuplicateGroup[]): Set<string> {
  const selected = new Set<string>();
  for (const group of groups) {
    for (const copy of group.copies) {
      if (copy.path !== group.keepPath) selected.add(copy.path);
    }
  }
  return selected;
}
