import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, FolderOpen, Square, Trash2 } from "lucide-react";
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

interface PendingDelete {
  paths: string[];
  keeping: string[];
  reclaimBytes: number;
  title: string;
}

/**
 * Inventory duplicates mode: choose scope → live log + streaming groups → simple trash delete.
 */
export function InventoryDuplicatesPanel({ rootPath, onBack }: InventoryDuplicatesPanelProps) {
  const [scope, setScope] = useState<DuplicateScanScopeId>(DEFAULT_DUPLICATE_SCAN_SCOPE);
  const [phase, setPhase] = useState<Phase>("choose");
  const [activeScope, setActiveScope] = useState<DuplicateScanScopeId | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [progress, setProgress] = useState<DuplicateScanProgress | null>(null);
  const [result, setResult] = useState<DuplicateScanResult | null>(null);
  const [liveGroups, setLiveGroups] = useState<DuplicateGroup[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [undoBatch, setUndoBatch] = useState<{ paths: string[]; reclaimBytes: number } | null>(
    null,
  );
  const [undoBusy, setUndoBusy] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return window.entropy.duplicates.onProgress((next) => {
      setProgress(next);
      if (next.logLine) {
        setLogLines((prev) => [...prev.slice(-120), next.logLine!]);
      }
      if (next.latestGroup) {
        setLiveGroups((prev) => upsertGroup(prev, next.latestGroup!));
      }
    });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [logLines.length]);

  useEffect(() => {
    if (phase !== "running" || !rootPath || !activeScope) return;
    let cancelled = false;
    setError(null);
    setResult(null);
    setProgress(null);
    setLiveGroups([]);
    setLogLines([]);
    void window.entropy.duplicates
      .scan(rootPath, { scope: activeScope })
      .then((next) => {
        if (!cancelled) {
          setResult(next);
          setLiveGroups(next.groups);
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
  }

  const running = phase === "running";
  const groups = phase === "done" && result ? result.groups : liveGroups;
  const percent = Math.round((progress?.progress ?? (running ? 0.05 : result ? 1 : 0)) * 100);
  const etaLabel = running ? formatEta(progress?.etaMs) : null;
  const scopeLabel =
    DUPLICATE_SCAN_SCOPES.find((item) => item.id === (activeScope ?? scope))?.label ?? "Images";

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete || pendingDelete.paths.length === 0) return;
    setDeleting(true);
    setError(null);
    const batch = [...pendingDelete.paths];
    const batchReclaim = pendingDelete.reclaimBytes;
    try {
      for (const filePath of batch) {
        await window.entropy.fs.remove(filePath);
      }
      setUndoBatch({ paths: batch, reclaimBytes: batchReclaim });
      const removed = new Set(batch);
      setLiveGroups((prev) => pruneGroups(prev, removed));
      setResult((prev) => {
        if (!prev) return prev;
        return { ...prev, groups: pruneGroups(prev.groups, removed) };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move files to Trash");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  async function undoCleanup(): Promise<void> {
    if (!undoBatch) return;
    setUndoBusy(true);
    setError(null);
    try {
      const outcome = await window.entropy.fs.undoRemove(undoBatch.paths);
      if (outcome.failed.length > 0 && outcome.restored === 0) {
        setError("Could not restore automatically — open Trash to recover files.");
        void window.entropy.fs.openTrash();
      } else {
        setUndoBatch(null);
        setPhase("choose");
        setResult(null);
        setLiveGroups([]);
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
              setLiveGroups([]);
              setProgress(null);
              setError(null);
              setLogLines([]);
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
                {progress?.message ?? (running ? `Scanning ${scopeLabel}…` : error ? error : "Ready")}
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
              {groups.length > 0
                ? ` · ${groups.length} group${groups.length === 1 ? "" : "s"} so far`
                : ""}
            </p>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_7.5rem]">
            <ScrollArea className="min-h-0">
              <div className="space-y-3 p-4">
                {!running && !error && groups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
                    <p className="text-sm text-foreground">No exact duplicates found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try another scope, or every matching file under this location is unique.
                    </p>
                  </div>
                ) : null}

                {running && groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Looking for identical files…</p>
                ) : null}

                {groups.map((group) => (
                  <DuplicateGroupCard
                    key={`${group.hash}-${group.size}`}
                    group={group}
                    disabled={running || deleting}
                    onDeleteCopy={(copyPath) => {
                      const keep = group.copies.find((c) => c.path !== copyPath);
                      setPendingDelete({
                        paths: [copyPath],
                        keeping: keep ? [baseName(keep.path)] : [],
                        reclaimBytes: group.size,
                        title: `Delete ${baseName(copyPath)}?`,
                      });
                    }}
                    onDeleteOtherCopies={() => {
                      const remove = group.copies.filter((c) => c.path !== group.keepPath);
                      setPendingDelete({
                        paths: remove.map((c) => c.path),
                        keeping: [baseName(group.keepPath)],
                        reclaimBytes: group.size * remove.length,
                        title: `Delete ${remove.length} duplicate cop${remove.length === 1 ? "y" : "ies"}?`,
                      });
                    }}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="border-t border-border bg-ink/40 px-4 py-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Activity
              </p>
              <ScrollArea className="h-[5.25rem]">
                <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  {logLines.length === 0 ? (
                    <p>Waiting…</p>
                  ) : (
                    logLines.map((line, index) => (
                      <p key={`${index}-${line}`} className="truncate">
                        {line}
                      </p>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="flex shrink-0 flex-col border-t border-border">
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
            <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-muted-foreground">
              <span className="min-w-0 truncate">
                {result
                  ? `${result.filesScanned.toLocaleString()} files · ${formatDuration(result.durationMs)}`
                  : progress
                    ? `${progress.filesSeen.toLocaleString()} seen`
                    : rootPath}
              </span>
              <span className="shrink-0">
                {groups.length > 0
                  ? `${groups.length} groups · use trash to remove copies`
                  : ""}
              </span>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.title ?? "Delete files?"}
        confirmLabel="Move to Trash"
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        description={
          pendingDelete ? (
            <DeletePreviewLists
              deleting={pendingDelete.paths.map(baseName)}
              keeping={pendingDelete.keeping}
              reclaimLabel={formatBytes(pendingDelete.reclaimBytes)}
            />
          ) : (
            ""
          )
        }
      />
    </div>
  );
}

function DuplicateGroupCard({
  group,
  disabled,
  onDeleteCopy,
  onDeleteOtherCopies,
}: {
  group: DuplicateGroup;
  disabled: boolean;
  onDeleteCopy: (path: string) => void;
  onDeleteOtherCopies: () => void;
}) {
  const extras = group.copies.filter((copy) => copy.path !== group.keepPath);

  return (
    <article className="rounded-xl border border-border bg-ink-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-medium text-foreground">
            {group.copies.length} copies · {formatBytes(group.size)} each
          </h2>
          <p className="text-[11px] text-muted-foreground">Exact duplicate · identical contents</p>
        </div>
        {extras.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground"
            disabled={disabled}
            onClick={onDeleteOtherCopies}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Delete copies · {formatBytes(group.recoverableBytes)}
          </Button>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1.5">
        {group.copies.map((copy) => {
          const keep = copy.path === group.keepPath;
          return (
            <li key={copy.path} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                  keep ? "bg-background text-foreground" : "text-muted-foreground",
                )}
              >
                {keep ? "Keep" : "Copy"}
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-muted-foreground hover:text-foreground"
                title={copy.path}
                onClick={() => void window.entropy.fs.reveal(copy.path)}
              >
                {copy.path}
              </button>
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
              {!keep ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  aria-label={`Delete ${baseName(copy.path)}`}
                  disabled={disabled}
                  onClick={() => onDeleteCopy(copy.path)}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function upsertGroup(groups: DuplicateGroup[], incoming: DuplicateGroup): DuplicateGroup[] {
  const key = `${incoming.hash}:${incoming.size}`;
  const without = groups.filter((group) => `${group.hash}:${group.size}` !== key);
  return [...without, incoming].sort((a, b) => b.recoverableBytes - a.recoverableBytes);
}

function pruneGroups(groups: DuplicateGroup[], removed: Set<string>): DuplicateGroup[] {
  const next: DuplicateGroup[] = [];
  for (const group of groups) {
    const copies = group.copies.filter((copy) => !removed.has(copy.path));
    if (copies.length < 2) continue;
    next.push({
      hash: group.hash,
      size: group.size,
      copies,
      recoverableBytes: group.size * (copies.length - 1),
      keepPath: copies.find((c) => c.path === group.keepPath)?.path ?? copies[0].path,
    });
  }
  return next;
}
