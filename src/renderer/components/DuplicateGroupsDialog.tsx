import { useEffect, useState } from "react";
import type { DuplicateGroup } from "../../shared/types";
import { Button } from "./ui/button";
import { useWorkspace } from "../state/useWorkspace";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface DuplicateGroupsDialogProps {
  open: boolean;
  rootPath: string;
  onClose: () => void;
}

export function DuplicateGroupsDialog({ open, rootPath, onClose }: DuplicateGroupsDialogProps) {
  const { openFileLocation } = useWorkspace();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !rootPath) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void window.entropy.fs
      .findDuplicateGroups(rootPath)
      .then((next) => {
        if (!cancelled) setGroups(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Scan failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, rootPath]);

  if (!open) return null;

  const recoverable = groups.reduce((sum, group) => sum + group.recoverableBytes, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" role="dialog" aria-modal="true" aria-label="Duplicate files">
      <button type="button" className="absolute inset-0 bg-ink/60" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-ink-2">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Duplicate files</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Content-identical copies (SHA-256). Filenames are ignored.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
          {loading
            ? "Scanning by content…"
            : error
              ? error
              : groups.length === 0
                ? "No content duplicates found in this location."
                : `${groups.length} group${groups.length === 1 ? "" : "s"} · ${formatBytes(recoverable)} recoverable`}
        </div>

        <ul className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
          {groups.map((group) => (
            <li key={group.hash} className="rounded-lg border border-border bg-background/30 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {group.copies.length} copies · {formatBytes(group.size)} each
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Recover {formatBytes(group.recoverableBytes)}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Keep recommendation: newest modified
              </p>
              <ul className="mt-2 space-y-1">
                {group.copies.map((copy) => {
                  const keep = copy.path === group.keepPath;
                  return (
                    <li key={copy.path} className="flex items-center gap-2 text-[11px]">
                      <span
                        className={
                          keep
                            ? "rounded bg-ink-2 px-1.5 py-0.5 font-medium text-foreground"
                            : "rounded px-1.5 py-0.5 text-muted-foreground"
                        }
                      >
                        {keep ? "Keep" : "Copy"}
                      </span>
                      <button
                        type="button"
                        className="min-w-0 truncate text-left text-muted-foreground hover:text-foreground"
                        title={copy.path}
                        onClick={() => {
                          void openFileLocation(copy.path);
                          onClose();
                        }}
                      >
                        {copy.path}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
