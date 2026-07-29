import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, Fragment, memo } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
  ArrowLeftRight,
} from "lucide-react";
import type { FileEntry, TreeNode } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { FolderTree } from "./FolderTree";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { StatusBar } from "../components/StatusBar";
import { ItemActionsMenu, type ItemAction } from "../components/ItemActionsMenu";
import { EntryPreview, useFolderCount } from "../components/EntryPreview";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MoveToDialog } from "../components/MoveToDialog";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
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
import { ThreeColumnLayout } from "../components/ThreeColumnLayout";
import { FileContextPanel } from "../components/FileContextPanel";
import { buildEntryActions, copyPath, moveEntryToFolder, revealPath } from "../lib/itemActions";
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
  const [movingEntry, setMovingEntry] = useState<FileEntry | null>(null);
  const [renderedCount, setRenderedCount] = useState(60);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const view = workspace.settings.filesView;

  const refreshTree = useCallback(async () => {
    try {
      setTree(await window.entropy.fs.folderTree(workspace.path));
    } catch {
      // Keep previous tree on failure.
    }
  }, [workspace.path]);

  const refreshListing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listing = await window.entropy.fs.listDir(workspace.currentFolder);
      setEntries(listing);

      const relative = workspace.currentFolder
        .slice(workspace.path.length)
        .replace(/^[/\\]+/, "");
      const parts = relative ? relative.split(/[/\\]/) : [];
      setCrumbs(parts);

      setSelected((current) => {
        if (!current) return null;
        return listing.find((entry) => entry.path === current.path) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read folder");
    } finally {
      setLoading(false);
    }
  }, [workspace.path, workspace.currentFolder]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshTree(), refreshListing()]);
  }, [refreshTree, refreshListing]);

  useEffect(() => {
    if (workspace.currentSection !== "inventory") return;
    void refreshTree();
  }, [refreshTree, workspace.currentSection]);

  useEffect(() => {
    if (workspace.currentSection !== "inventory") return;
    setRenderedCount(60);
    void refreshListing();
  }, [refreshListing, workspace.currentSection]);

  useEffect(() => {
    setRenaming(false);
    setRenameValue("");
  }, [workspace.currentFolder]);

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

  const rendered = useMemo(
    () => visible.slice(0, renderedCount),
    [visible, renderedCount],
  );

  useEffect(() => {
    setRenderedCount(60);
  }, [query, sortKey, sortAsc, workspace.currentFolder]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || loading || rendered.length >= visible.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setRenderedCount((count) => Math.min(count + 60, visible.length));
      },
      { root: null, rootMargin: "320px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible.length, rendered.length, view, loading]);

  async function openEntry(entry: FileEntry): Promise<void> {
    setRenaming(false);
    setRenameValue("");
    if (entry.isDirectory) {
      setCurrentFolder(entry.path);
      setSelected(null);
      return;
    }
    setSelected(entry);
    addRecentFile(entry.path);
  }

  async function goToCrumb(index: number): Promise<void> {
    setRenaming(false);
    setRenameValue("");
    setSelected(null);
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

  async function handleMoveDialog(destinationFolder: string): Promise<void> {
    const entry = movingEntry;
    setMovingEntry(null);
    if (!entry) return;
    try {
      const target = await moveEntryToFolder(entry.path, destinationFolder);
      await refresh();
      setSelected(await window.entropy.fs.stat(target));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move");
    }
  }

  function fileActions(entry: FileEntry) {
    return buildEntryActions({
      canReference: false,
      onRename: () => startRename(entry),
      onCopyPath: () => void copyPath(entry.path),
      onReveal: () => void revealPath(entry.path),
      onMoveTo: () => setMovingEntry(entry),
      onDelete: () => requestDelete(entry),
    });
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
    try {
      await moveEntryToFolder(source, folderPath);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move");
    }
  }

  const context = selected ? (
    <FileContextPanel
      selected={selected}
      renaming={renaming}
      renameValue={renameValue}
      onRenameValueChange={setRenameValue}
      onStartRename={() => startRename(selected)}
      onCommitRename={() => void commitRename()}
      onCancelRename={() => setRenaming(false)}
      onDuplicate={() => void handleDuplicate(selected)}
      onDelete={() => requestDelete(selected)}
    />
  ) : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col" aria-label="File Inventory">
      <ThreeColumnLayout
        id="inventory-layout"
        persistLayout={workspace.currentSection === "inventory"}
        context={context}
        sidebar={
          <div className="flex h-full min-h-0 flex-col">
            <div className="px-4 py-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Inventory
              </h2>
            </div>
            <ScrollArea className="min-h-0 flex-1 px-3">
              <button
                type="button"
                className={cn(
                  "mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                  workspace.currentFolder === workspace.path && "bg-accent text-foreground",
                  dragOverPath === workspace.path && "ring-1 ring-ring",
                )}
                onClick={() => setCurrentFolder(workspace.path)}
                onDragOver={(event) => onDragOver(event, workspace.path)}
                onDragLeave={() => setDragOverPath(null)}
                onDrop={(event) => void onDrop(event, workspace.path)}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">{workspace.name}</span>
              </button>
              <FolderTree
                nodes={tree}
                activePath={workspace.currentFolder}
                onSelect={setCurrentFolder}
              />
            </ScrollArea>
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={closeWorkspace}
                title="Switch workspace"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{workspace.name}</span>
              </button>
            </div>
          </div>
        }
        main={
          <section
            className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background"
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
                    className={cn(
                      "h-8 w-8 text-muted-foreground",
                      !sortAsc && "bg-ink-2 text-paper",
                    )}
                    aria-label={sortAsc ? "Sort ascending" : "Sort descending"}
                    aria-pressed={!sortAsc}
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
                    className={cn(
                      "h-8 w-8 text-muted-foreground",
                      view === "grid" && "bg-ink-2 text-paper",
                    )}
                    aria-label={view === "list" ? "Switch to grid view" : "Switch to list view"}
                    aria-pressed={view === "grid"}
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
                          actions={fileActions(entry)}
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
                      Drop files here or open a different folder from Inventory.
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
                    {rendered.map((entry) => (
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
                        <ItemActionsMenu label={entry.name} actions={fileActions(entry)} />
                      </div>
                    ))}
                    {rendered.length < visible.length ? (
                      <div ref={loadMoreRef} className="h-8" aria-hidden />
                    ) : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-x-4 gap-y-6">
                    {rendered.map((entry) => (
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
                        actions={fileActions(entry)}
                      />
                    ))}
                    {rendered.length < visible.length ? (
                      <div ref={loadMoreRef} className="col-span-full h-8" aria-hidden />
                    ) : null}
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>
        }
      />
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
      <MoveToDialog
        open={movingEntry !== null}
        rootPath={workspace.path}
        rootName={workspace.name}
        excludePath={movingEntry?.path ?? workspace.path}
        onClose={() => setMovingEntry(null)}
        onMove={(folder) => void handleMoveDialog(folder)}
      />
    </div>
  );
}

const FileGridCard = memo(function FileGridCard({
  entry,
  selected,
  dropTarget,
  onOpen,
  onDragStart,
  onDragOver,
  onDrop,
  actions,
}: {
  entry: FileEntry;
  selected: boolean;
  dropTarget: boolean;
  onOpen: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  actions: ItemAction[];
}) {
  const count = useFolderCount(entry.path, entry.isDirectory);

  return (
    <div
      draggable
      className={cn("group flex min-w-0 cursor-pointer flex-col gap-2", dropTarget && "opacity-70")}
      onClick={onOpen}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={cn(
          "entropy-media-card overflow-hidden rounded-xl",
          selected && "outline outline-1 outline-offset-2 outline-paper-2",
        )}
      >
        <EntryPreview entry={entry} size="lg" />
      </div>

      <div className="flex min-w-0 items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-[13px] text-foreground" title={entry.name}>
          {entry.name}
          {entry.isDirectory ? (
            <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[11px] text-muted-foreground">
              <Folder className="inline h-3 w-3" strokeWidth={1.5} />
              {count ?? "…"}
            </span>
          ) : null}
        </p>
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <ItemActionsMenu label={entry.name} actions={actions} />
        </div>
      </div>
    </div>
  );
});
