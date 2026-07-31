import { useEffect, useState } from "react";
import { ArrowLeft, Copy, FolderOpen, Square } from "lucide-react";
import type { DuplicateGroup, DuplicateScanProgress, DuplicateScanResult } from "../../shared/types";
import {
  DEFAULT_DUPLICATE_SCAN_SCOPE,
  DUPLICATE_SCAN_SCOPES,
  type DuplicateScanScopeId,
} from "../../shared/duplicateScopes";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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

interface InventoryDuplicatesPanelProps {
  rootPath: string;
  onBack: () => void;
}

/**
 * Inventory feature surface: replaces gallery + treemap content while active.
 * Does not own a separate BrowserWindow.
 */
export function InventoryDuplicatesPanel({ rootPath, onBack }: InventoryDuplicatesPanelProps) {
  const [scope, setScope] = useState<DuplicateScanScopeId>(DEFAULT_DUPLICATE_SCAN_SCOPE);
  const [scanKey, setScanKey] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DuplicateScanProgress | null>(null);
  const [result, setResult] = useState<DuplicateScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return window.entropy.duplicates.onProgress(setProgress);
  }, []);

  useEffect(() => {
    if (!rootPath) return;
    let cancelled = false;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    void window.entropy.duplicates
      .scan(rootPath, { scope })
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Scan failed");
        }
      })
      .finally(() => {
        if (!cancelled) setRunning(false);
      });
    return () => {
      cancelled = true;
      void window.entropy.duplicates.cancel();
    };
  }, [rootPath, scope, scanKey]);

  const groups: DuplicateGroup[] = result?.groups ?? [];
  const recoverable = groups.reduce((sum, group) => sum + group.recoverableBytes, 0);
  const percent = Math.round((progress?.progress ?? (running ? 0.05 : result ? 1 : 0)) * 100);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" aria-label="Duplicate files">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Back to folder"
          onClick={onBack}
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
        <Select
          value={scope}
          onValueChange={(value) => setScope(value as DuplicateScanScopeId)}
          disabled={running}
        >
          <SelectTrigger className="h-8 w-[9.5rem] shrink-0" aria-label="Scan scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DUPLICATE_SCAN_SCOPES.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {running ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2 text-xs"
            onClick={() => void window.entropy.duplicates.cancel()}
          >
            <Square className="h-3 w-3" strokeWidth={1.75} />
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            disabled={!rootPath}
            onClick={() => {
              setProgress(null);
              setError(null);
              setScanKey((key) => key + 1);
            }}
          >
            Rescan
          </Button>
        )}
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 truncate text-muted-foreground">
            {progress?.message ?? (running ? "Starting…" : error ? error : "Ready")}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-2">
          <div
            className="h-full rounded-full bg-paper-2"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Byte-identical only. Scope limits which files are checked — not how they match.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
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
                <h2 className="text-sm font-medium text-foreground">
                  {group.copies.length} copies · {formatBytes(group.size)} each
                </h2>
                <p className="text-sm text-muted-foreground">
                  Recover {formatBytes(group.recoverableBytes)}
                </p>
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
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-2 text-sm text-muted-foreground">
        <span className="min-w-0 truncate">
          {result
            ? `${result.filesScanned.toLocaleString()} files · ${formatDuration(result.durationMs)}`
            : progress
              ? `${progress.filesSeen.toLocaleString()} seen`
              : rootPath}
        </span>
        <span className="shrink-0">
          {groups.length > 0
            ? `${groups.length} groups · ${formatBytes(recoverable)} recoverable`
            : ""}
        </span>
      </div>
    </div>
  );
}
