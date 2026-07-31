import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { EntryPreview } from "../components/EntryPreview";
import { ItemActionsMenu } from "../components/ItemActionsMenu";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import { isPreviewableEntry } from "../lib/media";
import { buildEntryActions } from "../lib/itemActions";

const SKIP = new Set(["node_modules", ".git", ".svn", ".hg", "dist", "build", ".next", ".cache"]);

interface NotebookLibraryProps {
  rootPath: string;
  rootName: string;
  selectedPath: string | null;
  renamingPath?: string | null;
  renameValue?: string;
  onRenameValueChange?: (value: string) => void;
  onCommitRename?: (path: string) => void;
  onCancelRename?: () => void;
  onSelect: (entry: FileEntry) => void;
  onReference: (entry: FileEntry) => void;
  onOpenNote: (path: string) => void;
  onRename: (entry: FileEntry) => void;
  onCopyPath: (entry: FileEntry) => void;
  onReveal: (entry: FileEntry) => void;
  onMoveTo: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => void;
}

export function NotebookLibrary({
  rootPath,
  rootName,
  selectedPath,
  renamingPath = null,
  renameValue = "",
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onSelect,
  onReference,
  onOpenNote,
  onRename,
  onCopyPath,
  onReveal,
  onMoveTo,
  onDelete,
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
    <div className="min-w-0 pb-4">
      <LibraryFolder
        entry={rootEntry}
        depth={0}
        defaultOpen
        selectedPath={selectedPath}
        renamingPath={renamingPath}
        renameValue={renameValue}
        onRenameValueChange={onRenameValueChange}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
        onSelect={onSelect}
        onReference={onReference}
        onOpenNote={onOpenNote}
        onRename={onRename}
        onCopyPath={onCopyPath}
        onReveal={onReveal}
        onMoveTo={onMoveTo}
        onDelete={onDelete}
      />
    </div>
  );
}

type LibraryHandlers = Omit<
  NotebookLibraryProps,
  "rootPath" | "rootName"
>;

function LibraryFolder({
  entry,
  depth,
  defaultOpen = false,
  selectedPath,
  renamingPath,
  renameValue,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onSelect,
  onReference,
  onOpenNote,
  onRename,
  onCopyPath,
  onReveal,
  onMoveTo,
  onDelete,
}: {
  entry: FileEntry;
  depth: number;
  defaultOpen?: boolean;
} & LibraryHandlers) {
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
    <div className="min-w-0">
      <LibraryRow
        entry={entry}
        depth={depth}
        selected={selected}
        open={open}
        isFolder
        renaming={renamingPath === entry.path}
        renameValue={renameValue}
        onRenameValueChange={onRenameValueChange}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
        onActivate={() => void toggleFolder()}
        onReference={() => onReference(entry)}
        onRename={() => onRename(entry)}
        onCopyPath={() => onCopyPath(entry)}
        onReveal={() => onReveal(entry)}
        onMoveTo={() => onMoveTo(entry)}
        onDelete={() => onDelete(entry)}
      />
      {open ? (
        <div className="min-w-0">
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
                renamingPath={renamingPath}
                renameValue={renameValue}
                onRenameValueChange={onRenameValueChange}
                onCommitRename={onCommitRename}
                onCancelRename={onCancelRename}
                onSelect={onSelect}
                onReference={onReference}
                onOpenNote={onOpenNote}
                onRename={onRename}
                onCopyPath={onCopyPath}
                onReveal={onReveal}
                onMoveTo={onMoveTo}
                onDelete={onDelete}
              />
            ) : (
              <LibraryFile
                key={child.path}
                entry={child}
                depth={depth + 1}
                selected={selectedPath === child.path}
                renamingPath={renamingPath}
                renameValue={renameValue}
                onRenameValueChange={onRenameValueChange}
                onCommitRename={onCommitRename}
                onCancelRename={onCancelRename}
                onSelect={onSelect}
                onReference={onReference}
                onOpenNote={onOpenNote}
                onRename={onRename}
                onCopyPath={onCopyPath}
                onReveal={onReveal}
                onMoveTo={onMoveTo}
                onDelete={onDelete}
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
  renamingPath,
  renameValue,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onSelect,
  onReference,
  onOpenNote,
  onRename,
  onCopyPath,
  onReveal,
  onMoveTo,
  onDelete,
}: {
  entry: FileEntry;
  depth: number;
  selected: boolean;
} & Omit<LibraryHandlers, "selectedPath">) {
  const isNote = entry.extension.toLowerCase() === ".md";

  return (
    <LibraryRow
      entry={entry}
      depth={depth}
      selected={selected}
      open={false}
      isFolder={false}
      showPreview={isPreviewableEntry(entry)}
      renaming={renamingPath === entry.path}
      renameValue={renameValue}
      onRenameValueChange={onRenameValueChange}
      onCommitRename={onCommitRename}
      onCancelRename={onCancelRename}
      onActivate={() => {
        if (isNote) onOpenNote(entry.path);
        else onSelect(entry);
      }}
      onReference={() => onReference(entry)}
      onRename={() => onRename(entry)}
      onCopyPath={() => onCopyPath(entry)}
      onReveal={() => onReveal(entry)}
      onMoveTo={() => onMoveTo(entry)}
      onDelete={() => onDelete(entry)}
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
  renaming = false,
  renameValue = "",
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onActivate,
  onReference,
  onRename,
  onCopyPath,
  onReveal,
  onMoveTo,
  onDelete,
}: {
  entry: FileEntry;
  depth: number;
  selected: boolean;
  open: boolean;
  isFolder: boolean;
  showPreview?: boolean;
  renaming?: boolean;
  renameValue?: string;
  onRenameValueChange?: (value: string) => void;
  onCommitRename?: (path: string) => void;
  onCancelRename?: () => void;
  onActivate: () => void;
  onReference: () => void;
  onRename: () => void;
  onCopyPath: () => void;
  onReveal: () => void;
  onMoveTo: () => void;
  onDelete: () => void;
}) {
  if (renaming) {
    return (
      <div className="min-w-0 px-1" style={{ paddingLeft: 4 + depth * 10 }}>
        <Input
          className="h-8"
          value={renameValue}
          autoFocus
          onChange={(event) => onRenameValueChange?.(event.target.value)}
          onBlur={() => onCommitRename?.(entry.path)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCommitRename?.(entry.path);
            if (event.key === "Escape") onCancelRename?.();
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex min-w-0 items-center gap-0.5 rounded-md pr-0.5",
        selected && "bg-accent",
      )}
      style={{ paddingLeft: 4 + depth * 10 }}
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
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
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-ink-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          </span>
        )}
        <span className="min-w-0 truncate">
          {entry.isDirectory ? entry.name : entry.name.replace(/\.md$/i, "")}
        </span>
      </button>
      <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
        <ItemActionsMenu
          label={entry.name}
          actions={buildEntryActions({
            canReference: true,
            onRename,
            onReference,
            onCopyPath,
            onReveal,
            onMoveTo,
            onDelete,
          })}
        />
      </div>
    </div>
  );
}
