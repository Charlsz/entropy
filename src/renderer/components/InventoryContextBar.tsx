import { useEffect, useState } from "react";
import { ExternalLink, FolderOpen } from "lucide-react";
import type { FileEntry, NoteSearchResult } from "../../shared/types";
import { FILE_KIND_LABEL, kindFromExtension } from "../../shared/fileKinds";
import { Button } from "./ui/button";
import { useWorkspace } from "../state/useWorkspace";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatRelative(value: number): string {
  const delta = Date.now() - value;
  const day = 24 * 60 * 60 * 1000;
  if (delta < day) return "Today";
  if (delta < 7 * day) return `${Math.floor(delta / day)}d ago`;
  if (delta < 30 * day) return `${Math.floor(delta / (7 * day))}w ago`;
  if (delta < 365 * day) return `${Math.floor(delta / (30 * day))}mo ago`;
  return `${Math.floor(delta / (365 * day))}y ago`;
}

function samePath(a: string, b: string): boolean {
  return a.replace(/[/\\]+$/, "").toLowerCase() === b.replace(/[/\\]+$/, "").toLowerCase();
}

interface InventoryContextBarProps {
  selected: FileEntry;
  scanRoot: string;
  onOpenExternal: () => void;
  onReveal: () => void;
}

export function InventoryContextBar({
  selected,
  scanRoot,
  onOpenExternal,
  onReveal,
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
    : "Never in Entropy";
  const hint = selected.isDirectory
    ? null
    : loading
      ? null
      : noteRefs.length > 0
        ? `In ${noteRefs.length} note${noteRefs.length === 1 ? "" : "s"} — review before deleting`
        : duplicates.length > 0
          ? `Has ${duplicates.length} duplicate cop${duplicates.length === 1 ? "y" : "ies"} — one may be removable`
          : null;

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
            Modified {formatRelative(selected.modifiedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="entropy-context-action h-7 gap-1.5 px-2 text-xs"
            onClick={onReveal}
          >
            <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="entropy-context-action-label">Reveal</span>
          </Button>
          {!selected.isDirectory ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="entropy-context-action h-7 gap-1.5 px-2 text-xs"
              onClick={onOpenExternal}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="entropy-context-action-label">Open</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!selected.isDirectory ? (
        <dl className="entropy-context-meta mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          <Meta label="Last opened" value={lastOpened} />
          <Meta label="In notes" value={loading ? "…" : String(noteRefs.length)} />
          <Meta label="Duplicate copies" value={loading ? "…" : String(duplicates.length)} />
          <Meta
            label="Location"
            value={selected.path.split(/[/\\]/).slice(-2, -1)[0] || "—"}
          />
        </dl>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Open the folder to inspect its files, or use Storage to zoom into its size map.
        </p>
      )}

      {!loading && noteRefs.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {noteRefs.slice(0, 4).map((note) => (
            <li
              key={note.path}
              className="rounded-md bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              title={note.path}
            >
              {note.name.replace(/\.md$/i, "")}
            </li>
          ))}
          {noteRefs.length > 4 ? (
            <li className="px-1 text-[10px] text-muted-foreground">+{noteRefs.length - 4} more</li>
          ) : null}
        </ul>
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

      {hint ? <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
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
