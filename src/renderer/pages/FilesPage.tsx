import { useCallback, useEffect, useMemo, useState, type DragEvent, Fragment } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Copy,
  ExternalLink,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";
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
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
  const [recentEntries, setRecentEntries] = useState<FileEntry[]>([]);
  const [pendingDelete, setPendingDelete] = useState<FileEntry | null>(null);

  const view = workspace.settings.filesView;

  // Prefer Refern-style media grid as the Files home view.
  useEffect(() => {
    if (view !== "grid") {
      updateSettings({ filesView: "grid" });
    }
    // Only migrate once on first Files open for older sessions stuck on list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    const paths = workspace.recentFiles.slice(0, 8);

    void (async () => {
      const loaded: FileEntry[] = [];
      for (const filePath of paths) {
        try {
          if (!(await window.entropy.fs.exists(filePath))) continue;
          loaded.push(await window.entropy.fs.stat(filePath));
        } catch {
          // Skip missing recent entries.
        }
      }
      if (!cancelled) setRecentEntries(loaded);
    })();

    return () => {
      cancelled = true;
    };
  }, [workspace.recentFiles]);

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

  function requestDelete(entry: FileEntry): void {
    setPendingDelete(entry);
  }

  async function confirmDelete(): Promise<void> {
    const entry = pendingDelete;
    if (!entry) return;
    setPendingDelete(null);
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
        <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-ink-2">
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
              title="Switch workspace"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{workspace.name}</span>
            </button>
          </div>
        </aside>

        <section
          className="flex min-w-0 flex-1 flex-col bg-background"
          onDragOver={(event) => onDragOver(event, workspace.currentFolder)}
          onDrop={(event) => void onDrop(event, workspace.currentFolder)}
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList>
                <BreadcrumbItem>
                  {crumbs.length === 0 ? (
                    <BreadcrumbPage className="truncate">{workspace.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button
                        type="button"
                        className="truncate"
                        onClick={() => void goToCrumb(-1)}
                      >
                        {workspace.name}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {crumbs.map((part, index) => (
                  <Fragment key={`${part}-${index}`}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {index === crumbs.length - 1 ? (
                        <BreadcrumbPage className="truncate">{part}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button
                            type="button"
                            className="truncate"
                            onClick={() => void goToCrumb(index)}
                          >
                            {part}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <Input
              type="search"
              placeholder="Filter…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Filter files"
              className="h-8 w-36 border-border bg-transparent"
            />
            <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
              <SelectTrigger className="h-8 w-[110px]" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="modified">Modified</SelectItem>
                <SelectItem value="size">Size</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={sortAsc ? "Sort ascending" : "Sort descending"}
                  onClick={() => setSortAsc((v) => !v)}
                >
                  {sortAsc ? (
                    <ArrowUpNarrowWide className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <ArrowDownWideNarrow className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{sortAsc ? "Ascending" : "Descending"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={view === "list" ? "Grid view" : "List view"}
                  onClick={() => updateSettings({ filesView: view === "list" ? "grid" : "list" })}
                >
                  {view === "list" ? (
                    <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <List className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {view === "list" ? "Grid view" : "List view"}
              </TooltipContent>
            </Tooltip>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-4 pb-6">
              {error ? <p className="mb-3 text-xs text-paper-2">{error}</p> : null}

              {recentEntries.length > 0 ? (
                <section className="mb-6" aria-label="Recent files">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Recent
                    </h2>
                    <span className="text-[11px] text-muted-foreground">
                      {recentEntries.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-3 gap-y-4">
                    {recentEntries.map((entry) => (
                      <FileGridCard
                        key={`recent-${entry.path}`}
                        entry={entry}
                        selected={selected?.path === entry.path}
                        dropTarget={false}
                        onOpen={() => void openEntry(entry)}
                        onDragStart={(event) => onDragStart(event, entry)}
                        onRename={() => startRename(entry)}
                        onDelete={() => requestDelete(entry)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {loading ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-[4/3] w-full rounded-xl" />
                  ))}
                </div>
              ) : null}
              {!loading && visible.length === 0 ? (
                <Empty className="py-16">
                  <EmptyTitle>This folder is empty</EmptyTitle>
                  <EmptyDescription>
                    Drop files here or open a different folder from the library.
                  </EmptyDescription>
                </Empty>
              ) : null}

              {!loading && visible.length > 0 ? (
                <div className="mb-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {crumbs.length === 0 ? "Library" : crumbs[crumbs.length - 1]}
                  </h2>
                </div>
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
                            onSelect: () => requestDelete(entry),
                          },
                        ]}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-x-4 gap-y-6">
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
                      onDelete={() => requestDelete(entry)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </section>

        <aside className="flex w-[260px] shrink-0 flex-col border-l border-border bg-ink-2">
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

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {selected.isDirectory ? "Folder" : selected.extension || "File"}
                  </Badge>
                  {!selected.isDirectory ? (
                    <Badge variant="secondary">{formatBytes(selected.size)}</Badge>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Rename"
                        onClick={() => startRename(selected)}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rename</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Duplicate"
                        onClick={() => void handleDuplicate(selected)}
                      >
                        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Delete"
                        onClick={() => requestDelete(selected)}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Reveal in folder"
                        onClick={() => void window.entropy.fs.reveal(selected.path)}
                      >
                        <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reveal</TooltipContent>
                  </Tooltip>
                  {!selected.isDirectory ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Open externally"
                          onClick={() => void window.entropy.fs.openExternal(selected.path)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open</TooltipContent>
                    </Tooltip>
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
            <Empty>
              <EmptyTitle>Inspector</EmptyTitle>
              <EmptyDescription>Select a file to preview and manage it.</EmptyDescription>
            </Empty>
          )}
        </aside>
      </div>
      <StatusBar
        left={workspace.currentFolder}
        right={`${visible.length} items${selected ? ` · ${selected.name}` : ""}`}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Move to trash?"
        description={
          pendingDelete
            ? `Move "${pendingDelete.name}" to the system trash?`
            : "Move this item to the system trash?"
        }
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
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
      className={cn("flex cursor-pointer flex-col gap-2", dropTarget && "opacity-70")}
      onClick={onOpen}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl",
          selected && "outline outline-1 outline-offset-2 outline-paper-2",
        )}
      >
        <EntryPreview entry={entry} size="lg" />
      </div>

      <div className="flex min-w-0 items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-[13px] text-foreground">
          {entry.name}
          {entry.isDirectory ? (
            <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[11px] text-muted-foreground">
              <Folder className="inline h-3 w-3" strokeWidth={1.5} />
              {count ?? "…"}
            </span>
          ) : null}
        </p>
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
