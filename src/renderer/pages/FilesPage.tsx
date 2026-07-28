import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Folder, LayoutGrid, List, FolderOpen } from "lucide-react";
import type { FileEntry, TreeNode } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { FolderTree } from "./FolderTree";
import { FilePreview } from "./FilePreview";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { StatusBar } from "../components/StatusBar";
import { ItemActionsMenu } from "../components/ItemActionsMenu";
import { EntryPreview, useFolderCount } from "../components/EntryPreview";
import { cn } from "../lib/utils";

type SortKey = "name" | "modified" | "size" | "type";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString();
}

export function FilesPage() {
  const { workspace, setCurrentFolder, updateSettings, addRecentFile, closeWorkspace } =
    useWorkspace();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [crumbs, setCrumbs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const view = workspace.settings.filesView;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTree, listing] = await Promise.all([
        window.entropy.fs.folderTree(workspace.path),
        window.entropy.fs.listDir(workspace.currentFolder),
      ]);
      setTree(nextTree);
      setEntries(listing);

      const relative = workspace.currentFolder
        .slice(workspace.path.length)
        .replace(/^[/\\]+/, "");
      const parts = relative ? relative.split(/[/\\]/) : [];
      setCrumbs(parts);

      if (selected) {
        const stillThere = listing.find((entry) => entry.path === selected.path);
        setSelected(stillThere ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read folder");
    } finally {
      setLoading(false);
    }
  }, [workspace.path, workspace.currentFolder, selected]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.path, workspace.currentFolder]);

  const visible = useMemo(() => {
    const filtered = entries.filter((entry) =>
      entry.name.toLowerCase().includes(query.trim().toLowerCase()),
    );

    const sorted = [...filtered].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sortKey === "modified") cmp = a.modifiedAt - b.modifiedAt;
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "type") cmp = a.extension.localeCompare(b.extension);
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [entries, query, sortKey, sortAsc]);

  async function openEntry(entry: FileEntry): Promise<void> {
    if (entry.isDirectory) {
      setCurrentFolder(entry.path);
      setSelected(null);
      return;
    }
    setSelected(entry);
    addRecentFile(entry.path);
  }

  async function goToCrumb(index: number): Promise<void> {
    if (index < 0) {
      setCurrentFolder(workspace.path);
      return;
    }
    const parts = crumbs.slice(0, index + 1);
    const next = await window.entropy.fs.join(workspace.path, ...parts);
    setCurrentFolder(next);
  }

  function startRename(entry: FileEntry): void {
    setSelected(entry);
    setRenaming(true);
    setRenameValue(entry.name);
  }

  async function commitRename(): Promise<void> {
    if (!selected || !renaming) return;
    const nextName = renameValue.trim();
    setRenaming(false);
    if (!nextName || nextName === selected.name) return;

    try {
      const dir = await window.entropy.fs.dirname(selected.path);
      const target = await window.entropy.fs.join(dir, nextName);
      if (await window.entropy.fs.exists(target)) {
        setError("A file with that name already exists.");
        return;
      }
      await window.entropy.fs.rename(selected.path, target);
      await refresh();
      const info = await window.entropy.fs.stat(target);
      setSelected(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
    }
  }

  async function handleDelete(entry: FileEntry): Promise<void> {
    if (!window.confirm(`Move "${entry.name}" to the system trash?`)) return;
    try {
      await window.entropy.fs.remove(entry.path);
      if (selected?.path === entry.path) setSelected(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleDuplicate(entry: FileEntry): Promise<void> {
    try {
      const created = await window.entropy.fs.duplicate(entry.path);
      await refresh();
      const info = await window.entropy.fs.stat(created);
      setSelected(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate");
    }
  }

  async function moveToFolder(sourcePath: string, folderPath: string): Promise<void> {
    if (sourcePath === folderPath) return;
    const name = sourcePath.split(/[/\\]/).pop();
    if (!name) return;
    try {
      const target = await window.entropy.fs.join(folderPath, name);
      if (await window.entropy.fs.exists(target)) {
        setError("An item with that name already exists in the destination.");
        return;
      }
      await window.entropy.fs.rename(sourcePath, target);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move");
    }
  }

  function onDragStart(event: DragEvent, entry: FileEntry): void {
    event.dataTransfer.setData("application/x-entropy-path", entry.path);
    event.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(event: DragEvent, folderPath: string): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverPath(folderPath);
  }

  async function onDrop(event: DragEvent, folderPath: string): Promise<void> {
    event.preventDefault();
    setDragOverPath(null);
    const source = event.dataTransfer.getData("application/x-entropy-path");
    if (!source || source === folderPath) return;
    await moveToFolder(source, folderPath);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col" aria-label="Files">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-[hsl(var(--panel))]">
          <div className="px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Library
            </h2>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-2">
            <button
              type="button"
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                workspace.currentFolder === workspace.path && "bg-accent text-foreground",
                dragOverPath === workspace.path && "ring-1 ring-ring",
              )}
              onClick={() => setCurrentFolder(workspace.path)}
              onDragOver={(event) => onDragOver(event, workspace.path)}
              onDragLeave={() => setDragOverPath(null)}
              onDrop={(event) => void onDrop(event, workspace.path)}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{workspace.name}</span>
            </button>
            <FolderTree
              nodes={tree}
              activePath={workspace.currentFolder}
              onSelect={setCurrentFolder}
            />
          </ScrollArea>
          <div className="border-t border-border px-2 py-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={closeWorkspace}
            >
              <span className="truncate">{workspace.name}</span>
            </button>
          </div>
        </aside>

        <section
          className="flex min-w-0 flex-1 flex-col bg-background"
          onDragOver={(event) => onDragOver(event, workspace.currentFolder)}
          onDrop={(event) => void onDrop(event, workspace.currentFolder)}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm" aria-label="Breadcrumb">
              <button
                type="button"
                className="truncate text-muted-foreground hover:text-foreground"
                onClick={() => void goToCrumb(-1)}
              >
                {workspace.name}
              </button>
              {crumbs.map((part, index) => (
                <span key={`${part}-${index}`} className="flex min-w-0 items-center gap-1">
                  <span className="text-muted-foreground/40">/</span>
                  <button
                    type="button"
                    className="truncate text-muted-foreground hover:text-foreground"
                    onClick={() => void goToCrumb(index)}
                  >
                    {part}
                  </button>
                </span>
              ))}
            </nav>

            <Input
              type="search"
              placeholder="Filter…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Filter files"
              className="h-8 w-40 bg-[hsl(var(--panel))]"
            />
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              aria-label="Sort by"
              className="h-8 rounded-md border border-border bg-[hsl(var(--panel))] px-2 text-xs text-foreground"
            >
              <option value="name">Name</option>
              <option value="modified">Modified</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
            <Button type="button" variant="secondary" size="sm" onClick={() => setSortAsc((v) => !v)}>
              {sortAsc ? "Asc" : "Desc"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={view === "list" ? "Grid view" : "List view"}
              onClick={() => updateSettings({ filesView: view === "list" ? "grid" : "list" })}
            >
              {view === "list" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-3">
              {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
              {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
              {!loading && visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">This folder is empty.</p>
              ) : null}

              {view === "list" ? (
                <div className="space-y-0.5" role="table" aria-label="Files">
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_140px_72px_64px_28px] gap-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                    role="row"
                  >
                    <span>Name</span>
                    <span>Modified</span>
                    <span>Size</span>
                    <span>Type</span>
                    <span className="sr-only">Actions</span>
                  </div>
                  {visible.map((entry) => (
                    <div
                      key={entry.path}
                      role="row"
                      draggable
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_140px_72px_64px_28px] items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent",
                        selected?.path === entry.path && "bg-accent",
                        entry.isDirectory && dragOverPath === entry.path && "ring-1 ring-ring",
                      )}
                      onClick={() => void openEntry(entry)}
                      onDragStart={(event) => onDragStart(event, entry)}
                      onDragOver={
                        entry.isDirectory ? (event) => onDragOver(event, entry.path) : undefined
                      }
                      onDrop={
                        entry.isDirectory ? (event) => void onDrop(event, entry.path) : undefined
                      }
                    >
                      <span className="flex min-w-0 items-center gap-2 text-foreground">
                        <EntryPreview entry={entry} size="sm" />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatDate(entry.modifiedAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.isDirectory ? "—" : formatBytes(entry.size)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.isDirectory ? "Folder" : entry.extension || "File"}
                      </span>
                      <ItemActionsMenu
                        label={entry.name}
                        actions={[
                          { label: "Rename", onSelect: () => startRename(entry) },
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => void handleDelete(entry),
                          },
                        ]}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-3 gap-y-5">
                  {visible.map((entry) => (
                    <FileGridCard
                      key={entry.path}
                      entry={entry}
                      selected={selected?.path === entry.path}
                      dropTarget={entry.isDirectory && dragOverPath === entry.path}
                      onOpen={() => void openEntry(entry)}
                      onDragStart={(event) => onDragStart(event, entry)}
                      onDragOver={
                        entry.isDirectory ? (event) => onDragOver(event, entry.path) : undefined
                      }
                      onDrop={
                        entry.isDirectory ? (event) => void onDrop(event, entry.path) : undefined
                      }
                      onRename={() => startRename(entry)}
                      onDelete={() => void handleDelete(entry)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </section>

        <aside className="flex w-[260px] shrink-0 flex-col border-l border-border bg-[hsl(var(--panel))]">
          {selected ? (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-3 p-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {selected.isDirectory ? "Folder" : "Details"}
                </h2>

                {renaming ? (
                  <Input
                    value={renameValue}
                    autoFocus
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={() => void commitRename()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void commitRename();
                      if (event.key === "Escape") setRenaming(false);
                    }}
                  />
                ) : (
                  <p className="break-all text-sm font-medium text-foreground">{selected.name}</p>
                )}

                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="secondary" size="sm" onClick={() => startRename(selected)}>
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleDuplicate(selected)}
                  >
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleDelete(selected)}
                  >
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void window.entropy.fs.reveal(selected.path)}
                  >
                    Reveal
                  </Button>
                  {!selected.isDirectory ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void window.entropy.fs.openExternal(selected.path)}
                    >
                      Open
                    </Button>
                  ) : null}
                </div>

                {!selected.isDirectory ? (
                  <>
                    <Separator />
                    <FilePreview file={selected} />
                    <dl className="space-y-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Path</dt>
                        <dd className="break-all text-foreground">{selected.path}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Type</dt>
                        <dd>{selected.extension || "File"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Size</dt>
                        <dd>{formatBytes(selected.size)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Modified</dt>
                        <dd>{formatDate(selected.modifiedAt)}</dd>
                      </div>
                    </dl>
                  </>
                ) : null}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <h2 className="text-sm font-medium text-foreground">Inspector</h2>
              <p className="text-xs text-muted-foreground">
                Select a file to preview and manage it.
              </p>
            </div>
          )}
        </aside>
      </div>
      <StatusBar
        left={workspace.currentFolder}
        right={`${visible.length} items${selected ? ` · ${selected.name}` : ""}`}
      />
    </div>
  );
}

function FileGridCard({
  entry,
  selected,
  dropTarget,
  onOpen,
  onDragStart,
  onDragOver,
  onDrop,
  onRename,
  onDelete,
}: {
  entry: FileEntry;
  selected: boolean;
  dropTarget: boolean;
  onOpen: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const count = useFolderCount(entry.path, entry.isDirectory);

  return (
    <div
      draggable
      className={cn(
        "flex cursor-pointer flex-col gap-2",
        dropTarget && "opacity-80",
      )}
      onClick={onOpen}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={cn(
          "overflow-hidden rounded-lg",
          selected && "outline outline-1 outline-paper/40 outline-offset-1",
        )}
      >
        <EntryPreview entry={entry} size="lg" />
      </div>

      <div className="flex min-w-0 items-center gap-1 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-tight text-foreground">{entry.name}</p>
          {entry.isDirectory ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Folder className="h-3 w-3 shrink-0" strokeWidth={1.5} />
              <span>{count ?? "…"}</span>
            </p>
          ) : null}
        </div>
        <ItemActionsMenu
          label={entry.name}
          actions={[
            { label: "Rename", onSelect: onRename },
            { label: "Delete", destructive: true, onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  );
}
