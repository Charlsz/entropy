import { useEffect, useState } from "react";
import { ExternalLink, FileText, FolderOpen, Link2, NotebookPen } from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { FILE_KIND_LABEL, kindFromExtension } from "../../shared/fileKinds";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import { EntryPreview } from "./EntryPreview";
import { useWorkspace } from "../state/useWorkspace";
import {
  findFileConnections,
  type FileConnection,
} from "../lib/fileConnections";
import { samePath, osRevealLabel } from "../lib/platform";
import { formatBytes } from "../lib/format";
import { cn } from "../lib/utils";

function formatRelative(value: number): string {
  const delta = Date.now() - value;
  const day = 24 * 60 * 60 * 1000;
  if (delta < day) return "Today";
  if (delta < 7 * day) return `${Math.floor(delta / day)}d ago`;
  if (delta < 30 * day) return `${Math.floor(delta / (7 * day))}w ago`;
  if (delta < 365 * day) return `${Math.floor(delta / (30 * day))}mo ago`;
  return `${Math.floor(delta / (365 * day))}y ago`;
}

interface InventoryContextBarProps {
  selected: FileEntry;
  scanRoot: string;
  onOpenExternal: () => void;
  onReveal: () => void;
  onAddToWorkspace: () => void;
  onOpenNote?: (notePath: string) => void;
}

export function InventoryContextBar({
  selected,
  scanRoot,
  onOpenExternal,
  onReveal,
  onAddToWorkspace,
  onOpenNote,
}: InventoryContextBarProps) {
  const { workspace, openInWorkspace } = useWorkspace();
  const [connections, setConnections] = useState<FileConnection[]>([]);
  const [duplicates, setDuplicates] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingGo, setPendingGo] = useState<FileConnection | null>(null);

  useEffect(() => {
    if (selected.isDirectory) {
      setConnections([]);
      setDuplicates([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [refs, dups] = await Promise.all([
        findFileConnections(selected.path, {
          path: workspace.path,
          name: workspace.name,
        }).catch(() => [] as FileConnection[]),
        scanRoot
          ? window.entropy.fs.findDuplicates(scanRoot, selected.path).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setConnections(refs);
      setDuplicates(dups);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [scanRoot, selected.isDirectory, selected.path, workspace.name, workspace.path]);

  const kind = selected.isDirectory
    ? "Folder"
    : FILE_KIND_LABEL[kindFromExtension(selected.extension)]?.replace(/s$/, "") || "File";
  const lastOpened = workspace.recentFiles.some((path) => samePath(path, selected.path))
    ? "Recently"
    : "Never";

  function confirmGo(): void {
    if (!pendingGo) return;
    const target = pendingGo;
    setPendingGo(null);
    if (samePath(target.workspacePath, workspace.path)) {
      onOpenNote?.(target.notePath);
      return;
    }
    openInWorkspace(target.workspacePath, target.notePath);
  }

  return (
    <aside
      className="entropy-context-bar shrink-0 border-t border-border bg-ink/40 px-4 py-3"
      aria-label="Selection context"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {!selected.isDirectory ? (
            <div className="shrink-0 overflow-hidden rounded-md">
              <EntryPreview entry={selected} size="md" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground" title={selected.name}>
              {selected.name}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {kind}
              <span className="mx-1.5 text-border">·</span>
              {formatBytes(selected.size)}
              <span className="mx-1.5 text-border">·</span>
              {formatRelative(selected.modifiedAt)}
            </p>
            {!selected.isDirectory ? (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Link2 className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                <span>
                  {loading
                    ? "Checking connections…"
                    : connections.length === 1
                      ? "1 connection"
                      : `${connections.length} connections`}
                </span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!selected.isDirectory ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Add to Workspace"
              title="Add to Workspace"
              onClick={onAddToWorkspace}
            >
              <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={osRevealLabel()}
            title={osRevealLabel()}
            onClick={onReveal}
          >
            <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
          {!selected.isDirectory ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Open"
              title="Open"
              onClick={onOpenExternal}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          ) : null}
        </div>
      </div>

      {!selected.isDirectory ? (
        <dl className="entropy-context-meta mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          <Meta label="Opened" value={lastOpened} />
          <Meta label="Duplicates" value={loading ? "…" : String(duplicates.length)} />
        </dl>
      ) : null}

      {!selected.isDirectory ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Used by
          </p>
          {loading ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">Looking across workspaces…</p>
          ) : connections.length === 0 ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              No notes in recent workspaces reference this file.
            </p>
          ) : (
            <ul className="relative mt-2 space-y-1.5 border-l border-dashed border-border pl-3">
              {connections.slice(0, 8).map((conn) => {
                const current = samePath(conn.workspacePath, workspace.path);
                return (
                  <li key={`${conn.workspacePath}:${conn.notePath}`}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full min-w-0 items-center gap-2 rounded-lg bg-background/50 px-2.5 py-2 text-left",
                        "hover:bg-ink-2",
                      )}
                      title={`${conn.noteName} — ${conn.workspaceName}`}
                      onClick={() => setPendingGo(conn)}
                    >
                      <FileText
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        strokeWidth={1.75}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {conn.noteName}
                      </span>
                      <span className="shrink-0 truncate text-[11px] text-muted-foreground">
                        {current ? "this workspace" : conn.workspaceName}
                      </span>
                    </button>
                  </li>
                );
              })}
              {connections.length > 8 ? (
                <li className="px-1 text-[10px] text-muted-foreground">
                  +{connections.length - 8} more
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}

      {!loading && duplicates.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {duplicates.slice(0, 2).map((dup) => (
            <li key={dup.path} className="truncate text-[10px] text-muted-foreground" title={dup.path}>
              {dup.path.split(/[/\\]/).slice(-2).join(" › ")}
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={pendingGo !== null}
        title="Open note?"
        description={
          pendingGo
            ? `Open “${pendingGo.noteName}” in ${pendingGo.workspaceName}?${
                samePath(pendingGo.workspacePath, workspace.path)
                  ? ""
                  : " This switches your workspace."
              }`
            : ""
        }
        confirmLabel="Open"
        onConfirm={confirmGo}
        onOpenChange={(open) => {
          if (!open) setPendingGo(null);
        }}
      />
    </aside>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground/90">{value}</dd>
    </div>
  );
}
