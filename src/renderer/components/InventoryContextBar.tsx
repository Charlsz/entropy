import { useEffect, useState } from "react";
import { ExternalLink, FolderOpen, Link2 } from "lucide-react";
import type { FileEntry, NoteSearchResult } from "../../shared/types";
import { FILE_KIND_LABEL, kindFromExtension } from "../../shared/fileKinds";
import { Button } from "./ui/button";
import { useWorkspace } from "../state/useWorkspace";
import { samePath, osRevealLabel } from "../lib/platform";
import { formatBytes } from "../lib/format";

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
  const { workspace } = useWorkspace();
  const [noteRefs, setNoteRefs] = useState<NoteSearchResult[]>([]);
  const [duplicates, setDuplicates] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected.isDirectory) {
      setNoteRefs([]);
      setDuplicates([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [refs, dups] = await Promise.all([
        window.entropy.fs.findFileReferences(workspace.path, selected.path).catch(() => []),
        scanRoot
          ? window.entropy.fs.findDuplicates(scanRoot, selected.path).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setNoteRefs(refs);
      setDuplicates(dups);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [scanRoot, selected.isDirectory, selected.path, workspace.path]);

  const kind = selected.isDirectory
    ? "Folder"
    : FILE_KIND_LABEL[kindFromExtension(selected.extension)]?.replace(/s$/, "") || "File";
  const lastOpened = workspace.recentFiles.some((path) => samePath(path, selected.path))
    ? "Recently"
    : "Never";

  return (
    <aside
      className="entropy-context-bar shrink-0 border-t border-border bg-ink/40 px-4 py-3"
      aria-label="Selection context"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
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
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
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

      {!loading && noteRefs.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Referenced in
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {noteRefs.slice(0, 6).map((note) => (
              <li key={note.path}>
                <button
                  type="button"
                  className="rounded-md bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-ink-2 hover:text-foreground"
                  title={note.path}
                  onClick={() => onOpenNote?.(note.path)}
                >
                  {note.name.replace(/\.md$/i, "")}
                </button>
              </li>
            ))}
            {noteRefs.length > 6 ? (
              <li className="px-1 text-[10px] text-muted-foreground">+{noteRefs.length - 6}</li>
            ) : null}
          </ul>
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
