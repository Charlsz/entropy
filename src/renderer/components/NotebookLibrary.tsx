import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Link2 } from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { EntryPreview } from "../components/EntryPreview";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../lib/utils";
import { isMediaEntry } from "../lib/media";

const SKIP = new Set(["node_modules", ".git", ".svn", ".hg", "dist", "build", ".next", ".cache"]);

interface NotebookLibraryProps {
  rootPath: string;
  rootName: string;
  selectedPath: string | null;
  onSelect: (entry: FileEntry) => void;
  onReference: (entry: FileEntry) => void;
  onOpenNote: (path: string) => void;
}

export function NotebookLibrary({
  rootPath,
  rootName,
  selectedPath,
  onSelect,
  onReference,
  onOpenNote,
}: NotebookLibraryProps) {
  const rootEntry: FileEntry = {
    name: rootName,
    path: rootPath,
    isDirectory: true,
    size: 0,
    modifiedAt: 0,
    extension: "",
  };

  return (
    <div className="pb-4">
      <LibraryFolder
        entry={rootEntry}
        depth={0}
        defaultOpen
        selectedPath={selectedPath}
        onSelect={onSelect}
        onReference={onReference}
        onOpenNote={onOpenNote}
      />
    </div>
  );
}

function LibraryFolder({
  entry,
  depth,
  defaultOpen = false,
  selectedPath,
  onSelect,
  onReference,
  onOpenNote,
}: {
  entry: FileEntry;
  depth: number;
  defaultOpen?: boolean;
  selectedPath: string | null;
  onSelect: (entry: FileEntry) => void;
  onReference: (entry: FileEntry) => void;
  onOpenNote: (path: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const selected = selectedPath === entry.path;

  const loadChildren = useCallback(async () => {
    setLoading(true);
    try {
      const listing = await window.entropy.fs.listDir(entry.path);
      const filtered = listing
        .filter((item) => !SKIP.has(item.name) && !item.name.startsWith("."))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
      setChildren(filtered);
    } catch {
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [entry.path]);

  useEffect(() => {
    if (defaultOpen && children === null) {
      void loadChildren();
    }
  }, [defaultOpen, children, loadChildren]);

  async function toggleFolder(): Promise<void> {
    if (open) {
      setOpen(false);
      onSelect(entry);
      return;
    }
    if (children === null) await loadChildren();
    setOpen(true);
    onSelect(entry);
  }

  return (
    <div>
      <LibraryRow
        entry={entry}
        depth={depth}
        selected={selected}
        open={open}
        isFolder
        onActivate={() => void toggleFolder()}
        onReference={() => onReference(entry)}
      />
      {open ? (
        <div>
          {loading && children === null ? (
            <p
              className="py-1 text-[11px] text-muted-foreground"
              style={{ paddingLeft: 12 + depth * 12 }}
            >
              Loading…
            </p>
          ) : null}
          {(children ?? []).map((child) =>
            child.isDirectory ? (
              <LibraryFolder
                key={child.path}
                entry={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onReference={onReference}
                onOpenNote={onOpenNote}
              />
            ) : (
              <LibraryFile
                key={child.path}
                entry={child}
                depth={depth + 1}
                selected={selectedPath === child.path}
                onSelect={onSelect}
                onReference={onReference}
                onOpenNote={onOpenNote}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function LibraryFile({
  entry,
  depth,
  selected,
  onSelect,
  onReference,
  onOpenNote,
}: {
  entry: FileEntry;
  depth: number;
  selected: boolean;
  onSelect: (entry: FileEntry) => void;
  onReference: (entry: FileEntry) => void;
  onOpenNote: (path: string) => void;
}) {
  const isNote = entry.extension.toLowerCase() === ".md";

  return (
    <LibraryRow
      entry={entry}
      depth={depth}
      selected={selected}
      open={false}
      isFolder={false}
      showPreview={isMediaEntry(entry)}
      onActivate={() => {
        if (isNote) onOpenNote(entry.path);
        else onSelect(entry);
      }}
      onReference={() => onReference(entry)}
    />
  );
}

function LibraryRow({
  entry,
  depth,
  selected,
  open,
  isFolder,
  showPreview = false,
  onActivate,
  onReference,
}: {
  entry: FileEntry;
  depth: number;
  selected: boolean;
  open: boolean;
  isFolder: boolean;
  showPreview?: boolean;
  onActivate: () => void;
  onReference: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md pr-1",
        selected && "bg-accent",
      )}
      style={{ paddingLeft: 4 + depth * 10 }}
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
          selected && "text-foreground",
        )}
        onClick={onActivate}
        title={isFolder ? (open ? "Collapse folder" : "Expand folder") : entry.name}
      >
        {isFolder ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.75} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.75} />
          )
        ) : null}
        {isFolder || showPreview ? (
          <EntryPreview entry={entry} size="sm" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-ink-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          </span>
        )}
        <span className="truncate">{entry.isDirectory ? entry.name : entry.name.replace(/\.md$/i, "")}</span>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
            aria-label={`Reference ${entry.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onReference();
            }}
          >
            <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Reference in note</TooltipContent>
      </Tooltip>
    </div>
  );
}
