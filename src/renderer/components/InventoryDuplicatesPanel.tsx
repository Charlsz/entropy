import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Copy,
  Filter,
  FolderOpen,
  Square,
  Trash2,
} from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { osRevealLabel, osTrashName } from "../lib/platform";
import { cn } from "../lib/utils";
import { formatBytes } from "../lib/format";

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

/** Last segments for dense lists; full path stays in title. */
function shortPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 3) return parts.join(" › ");
  return `… › ${parts.slice(-3).join(" › ")}`;
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
      setError(err instanceof Error ? err.message : `Failed to move files to ${osTrashName()}`);
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
        setError(`Could not restore automatically — open ${osTrashName()} to recover files.`);
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
    <div
      className="entropy-duplicates flex h-full min-h-0 flex-col bg-background"
      aria-label="Duplicate files"
    >
      <div className="border-b border-border px-4 py-3">
        <div className="entropy-readable flex items-center gap-2">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Change scope"
                  onClick={() => {
                    setResult(null);
                    setLiveGroups([]);
                    setProgress(null);
                    setError(null);
                    setLogLines([]);
                    setPhase("choose");
                  }}
                >
                  <Filter className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Change scope</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {phase === "choose" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
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
            <div className="entropy-readable">
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
                {scopeLabel}
                {groups.length > 0
                  ? ` · ${groups.length} group${groups.length === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(5rem,7.5rem)]">
            <ScrollArea className="min-h-0">
              <div className="entropy-readable space-y-3 px-4 py-4">
                {!running && !error && groups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
                    <p className="text-sm text-foreground">No exact duplicates found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try another scope — every matching file here is unique.
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
              <div className="entropy-readable">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Activity
                </p>
                <ScrollArea className="h-[4.5rem]">
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
            <div className="px-4 py-2 text-sm text-muted-foreground">
              <div className="entropy-readable flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {result
                    ? `${result.filesScanned.toLocaleString()} files · ${formatDuration(result.durationMs)}`
                    : progress
                      ? `${progress.filesSeen.toLocaleString()} seen`
                      : rootPath}
                </span>
                <span className="shrink-0">
                  {groups.length > 0 ? `${groups.length} groups` : ""}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.title ?? "Delete files?"}
        confirmLabel="Move"
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
    <article className="rounded-xl border border-border bg-ink-2 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-sm font-medium text-foreground">
          {group.copies.length} × {formatBytes(group.size)}
        </h2>
        {extras.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                disabled={disabled}
                aria-label={`Delete other copies · reclaim ${formatBytes(group.recoverableBytes)}`}
                onClick={onDeleteOtherCopies}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Delete other copies · {formatBytes(group.recoverableBytes)}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <ul className="mt-2.5 space-y-1">
        {group.copies.map((copy) => {
          const keep = copy.path === group.keepPath;
          return (
            <li key={copy.path} className="entropy-dup-row flex items-center gap-1.5 text-sm">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                  keep ? "bg-background text-foreground" : "text-muted-foreground/50",
                )}
                title={keep ? "Keep" : "Copy"}
                aria-label={keep ? "Keep" : "Copy"}
              >
                {keep ? (
                  <Bookmark className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </span>
              <button
                type="button"
                className="entropy-dup-path min-w-0 flex-1 truncate text-left text-muted-foreground hover:text-foreground"
                title={copy.path}
                onClick={() => void window.entropy.fs.reveal(copy.path)}
              >
                {shortPath(copy.path)}
              </button>
              <div className="entropy-dup-actions flex shrink-0 items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={osRevealLabel()}
                      onClick={() => void window.entropy.fs.reveal(copy.path)}
                    >
                      <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{osRevealLabel()}</TooltipContent>
                </Tooltip>
                {!keep ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        aria-label={`Delete ${baseName(copy.path)}`}
                        disabled={disabled}
                        onClick={() => onDeleteCopy(copy.path)}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
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
