import { useEffect, useState } from "react";
import { Copy, FolderOpen, Square } from "lucide-react";
import type { DuplicateGroup, DuplicateScanProgress, DuplicateScanResult } from "../../shared/types";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { StatusBar } from "../components/StatusBar";
import { WindowControls } from "../components/WindowControls";
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

export function DuplicatesWindow({ initialRoot }: { initialRoot: string }) {
  const [rootPath, setRootPath] = useState(initialRoot);
  const [scanKey, setScanKey] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DuplicateScanProgress | null>(null);
  const [result, setResult] = useState<DuplicateScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onRoot(event: Event): void {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail) {
        setRootPath(detail);
        setResult(null);
        setProgress(null);
        setError(null);
      }
    }
    window.addEventListener("entropy:duplicates-root", onRoot);
    return () => window.removeEventListener("entropy:duplicates-root", onRoot);
  }, []);

  useEffect(() => {
    return window.entropy.duplicates.onProgress(setProgress);
  }, []);

  useEffect(() => {
    if (!rootPath) return;
    let cancelled = false;
    setRunning(true);
    setError(null);
    setResult(null);
    void window.entropy.duplicates
      .scan(rootPath)
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
  }, [rootPath, scanKey]);

  const groups: DuplicateGroup[] = result?.groups ?? [];
  const recoverable = groups.reduce((sum, group) => sum + group.recoverableBytes, 0);
  const percent = Math.round((progress?.progress ?? (running ? 0.05 : 1)) * 100);

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="drag-region flex h-10 shrink-0 items-center justify-between border-b border-border bg-ink pl-3 pr-0">
        <div className="no-drag flex min-w-0 items-center gap-2">
          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Exact duplicate files</p>
            <p className="truncate text-[11px] text-muted-foreground" title={rootPath}>
              {rootPath || "No folder selected"}
            </p>
          </div>
        </div>
        <div className="no-drag flex items-center gap-1 pr-1">
          {running ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
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
              className="h-7 px-2 text-xs"
              disabled={!rootPath || running}
              onClick={() => {
                setProgress(null);
                setError(null);
                setScanKey((key) => key + 1);
              }}
            >
              Rescan
            </Button>
          )}
          <WindowControls />
        </div>
      </header>

      <div className="border-b border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {progress?.message ?? (running ? "Starting…" : error ? error : "Ready")}
          </span>
          <span className="tabular-nums text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-2">
          <div
            className="h-full rounded-full bg-paper-2 transition-[width] duration-150 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Byte-identical only (BLAKE3 + verification). Similar or resized media are never matched.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          {!running && !error && groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm text-foreground">No exact duplicates found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every file under this location has unique contents.
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

      <StatusBar
        left={
          result
            ? `${result.filesScanned.toLocaleString()} files · ${formatDuration(result.durationMs)}`
            : rootPath
        }
        right={
          groups.length > 0
            ? `${groups.length} groups · ${formatBytes(recoverable)} recoverable`
            : progress
              ? `${progress.filesSeen.toLocaleString()} seen`
              : ""
        }
      />
    </div>
  );
}
