import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, memo } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  FileText,
  Folder,
  LayoutGrid,
  List,
  Plus,
} from "lucide-react";
import type { FileEntry, InventoryRoot, TreemapFileLeaf, TreemapScanResult } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { StatusBar } from "../components/StatusBar";
import { ItemActionsMenu, type ItemAction } from "../components/ItemActionsMenu";
import { EntryPreview, getFolderPreview, useFolderCount } from "../components/EntryPreview";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MoveToDialog } from "../components/MoveToDialog";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ThreeColumnLayout } from "../components/ThreeColumnLayout";
import { StorageTreemap } from "../components/StorageTreemap";
import { InventoryContextBar } from "../components/InventoryContextBar";
import { buildEntryActions, copyPath, moveEntryToFolder, revealPath } from "../lib/itemActions";
import { isMediaEntry } from "../lib/media";
import {
  INVENTORY_FILTERS,
  entryMatchesFilters,
  filtersNeedRelations,
  type EntryRelationFlags,
  type InventoryFilterId,
} from "../lib/inventoryFilters";
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

function samePath(a: string, b: string): boolean {
  return a.replace(/[/\\]+$/, "").toLowerCase() === b.replace(/[/\\]+$/, "").toLowerCase();
}

function isUnderPath(folder: string, root: string): boolean {
  const left = folder.replace(/[/\\]+$/, "").toLowerCase();
  const right = root.replace(/[/\\]+$/, "").toLowerCase();
  return left === right || left.startsWith(`${right}\\`) || left.startsWith(`${right}/`);
}

function pickRoot(folder: string, roots: InventoryRoot[]): InventoryRoot | null {
  const matches = roots.filter((root) => isUnderPath(folder, root.path));
  matches.sort((a, b) => b.path.length - a.path.length);
  return matches[0] ?? null;
}

export function FilesPage() {
  const {
    workspace,
    updateSettings,
    addRecentFile,
    referenceInNote,
    goToFolder,
    setInventoryRoot,
    visitPreview,
  } = useWorkspace();
  const [roots, setRoots] = useState<InventoryRoot[]>([]);
  const [mountRoots, setMountRoots] = useState<InventoryRoot[]>([]);
  const [scanRoot, setScanRoot] = useState<string>("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [sizeByPath, setSizeByPath] = useState<Record<string, number>>({});
  const [treemapScan, setTreemapScan] = useState<TreemapScanResult | null>(null);
  const [scanningTreemap, setScanningTreemap] = useState(false);
  const [pendingSelectPath, setPendingSelectPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<InventoryFilterId>>(() => new Set());
  const [relationFlags, setRelationFlags] = useState<Record<string, EntryRelationFlags>>({});
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [recentEntries, setRecentEntries] = useState<FileEntry[]>([]);
  const [pendingDelete, setPendingDelete] = useState<FileEntry | null>(null);
  const [movingEntry, setMovingEntry] = useState<FileEntry | null>(null);
  const [renderedCount, setRenderedCount] = useState(60);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const homeBootstrapped = useRef(false);

  const view = workspace.settings.filesView;
  const activeRoot = pickRoot(workspace.currentFolder, roots) ?? roots[0] ?? null;
  const rootLabel = activeRoot?.name ?? "Home";

  const refreshListing = useCallback(async () => {
    if (!workspace.currentFolder) return;
    setLoading(true);
    setError(null);
    try {
      const listing = await window.entropy.fs.listDir(workspace.currentFolder);
      setEntries(listing);

      setSelected((current) => {
        if (!current) return null;
        return listing.find((entry) => entry.path === current.path) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read folder");
    } finally {
      setLoading(false);
    }
  }, [scanRoot, workspace.currentFolder]);

  const refresh = useCallback(async () => {
    await refreshListing();
  }, [refreshListing]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const extra = workspace.settings.inventoryExtraRoots ?? [];
        const [nextRoots, mounts] = await Promise.all([
          window.entropy.fs.getInventoryRoots(extra),
          window.entropy.fs.listMountRoots(),
        ]);
        if (cancelled) return;
        setRoots(nextRoots);
        setMountRoots(
          mounts.filter(
            (mount) =>
              !nextRoots.some((root) => samePath(root.path, mount.path)) &&
              !extra.some((path) => samePath(path, mount.path)),
          ),
        );
        const home =
          nextRoots.find((root) => root.id === "home")?.path ??
          (await window.entropy.fs.getHomePath());
        if (!homeBootstrapped.current) {
          homeBootstrapped.current = true;
          setScanRoot(home);
          if (samePath(workspace.currentFolder, workspace.path) || !workspace.currentFolder) {
            goToFolder(home, "replace");
          } else {
            const match = pickRoot(workspace.currentFolder, nextRoots);
            setScanRoot(match?.path ?? home);
            goToFolder(workspace.currentFolder, "replace");
          }
        }
      } catch {
        // Roots unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once; refresh when extra roots change
  }, [workspace.settings.inventoryExtraRoots]);

  async function addFolderRoot(): Promise<void> {
    const picked = await window.entropy.fs.pickInventoryFolder();
    if (!picked) return;
    const existing = workspace.settings.inventoryExtraRoots ?? [];
    if (existing.some((path) => samePath(path, picked))) {
      selectRootPath(picked);
      return;
    }
    updateSettings({ inventoryExtraRoots: [...existing, picked] });
    setScanRoot(picked);
    goToFolder(picked, "replace");
  }

  function addMountRoot(root: InventoryRoot): void {
    const existing = workspace.settings.inventoryExtraRoots ?? [];
    if (!existing.some((path) => samePath(path, root.path))) {
      updateSettings({ inventoryExtraRoots: [...existing, root.path] });
    }
    selectRoot(root);
  }

  function selectRootPath(rootPath: string): void {
    setScanRoot(rootPath);
    goToFolder(rootPath, "replace");
  }

  useEffect(() => {
    if (!roots.length || !workspace.currentFolder) return;
    const match = pickRoot(workspace.currentFolder, roots);
    if (match && !samePath(match.path, scanRoot)) {
      setScanRoot(match.path);
    }
  }, [roots, scanRoot, workspace.currentFolder]);

  useEffect(() => {
    if (!scanRoot) return;
    const label =
      roots.find((root) => samePath(root.path, scanRoot))?.name ??
      activeRoot?.name ??
      "Home";
    setInventoryRoot(scanRoot, label);
  }, [activeRoot?.name, roots, scanRoot, setInventoryRoot]);

  useEffect(() => {
    if (workspace.currentSection !== "inventory") return;
    setRenderedCount(60);
    setSelected(null);
    void refreshListing();
  }, [refreshListing, workspace.currentSection]);

  useEffect(() => {
    setSelected(null);
  }, [workspace.currentFolder]);

  useEffect(() => {
    if (!workspace.inventoryFocusPath) return;
    setPendingSelectPath(workspace.inventoryFocusPath);
  }, [workspace.inventoryFocusPath]);

  useEffect(() => {
    if (workspace.currentSection !== "inventory" || !workspace.currentFolder) return;
    let cancelled = false;
    void (async () => {
      try {
        const measured = await window.entropy.fs.measureChildren(workspace.currentFolder);
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const item of measured) next[item.path] = item.size;
        setSizeByPath(next);
      } catch {
        if (!cancelled) setSizeByPath({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace.currentFolder, workspace.currentSection]);

  useEffect(() => {
    if (workspace.currentSection !== "inventory" || !workspace.currentFolder) return;
    let cancelled = false;
    setScanningTreemap(true);
    void (async () => {
      try {
        const next = await window.entropy.fs.scanTreemapLevel(workspace.currentFolder);
        if (!cancelled) setTreemapScan(next);
      } catch {
        if (!cancelled) setTreemapScan(null);
      } finally {
        if (!cancelled) setScanningTreemap(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace.currentFolder, workspace.currentSection]);

  useEffect(() => {
    if (!pendingSelectPath || loading) return;
    const match = entries.find((entry) => entry.path === pendingSelectPath);
    if (match) {
      setSelected(match);
      setPendingSelectPath(null);
      return;
    }
    // Listing finished without the file (filtered away) — clear pending.
    if (!loading) setPendingSelectPath(null);
  }, [pendingSelectPath, entries, loading]);

  async function selectTreemapLeaf(leaf: TreemapFileLeaf, openAfter = false): Promise<void> {
    try {
      if (leaf.isDirectory) {
        const match = entries.find((entry) => samePath(entry.path, leaf.path));
        setSelected(match ?? null);
        return;
      }
      const info = await window.entropy.fs.stat(leaf.path);
      const parent = await window.entropy.fs.dirname(leaf.path);
      if (!samePath(parent, workspace.currentFolder)) {
        setPendingSelectPath(leaf.path);
        goToFolder(parent);
      } else {
        setSelected(info);
      }
      if (openAfter) {
        addRecentFile(leaf.path);
        void window.entropy.fs.openExternal(leaf.path);
      }
    } catch {
      setError("Could not open that item from the size map.");
    }
  }

  async function zoomTreemapFolder(leaf: TreemapFileLeaf): Promise<void> {
    if (!leaf.isDirectory) return;
    goToFolder(leaf.path);
  }

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

  const sizedEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        size: sizeByPath[entry.path] ?? entry.size,
      })),
    [entries, sizeByPath],
  );

  const visible = useMemo(() => {
    const filtered = sizedEntries.filter((entry) => {
      if (!entry.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return entryMatchesFilters(
        entry,
        activeFilters,
        workspace.recentFiles,
        filtersNeedRelations(activeFilters) ? relationFlags : null,
      );
    });

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
  }, [
    sizedEntries,
    query,
    sortKey,
    sortAsc,
    activeFilters,
    workspace.recentFiles,
    relationFlags,
  ]);

  useEffect(() => {
    if (!filtersNeedRelations(activeFilters)) return;
    const files = sizedEntries.filter((entry) => !entry.isDirectory);
    if (files.length === 0) {
      setRelationFlags({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, EntryRelationFlags> = {};
      for (const file of files.slice(0, 80)) {
        if (cancelled) return;
        const [noteRefs, duplicates] = await Promise.all([
          window.entropy.fs.findFileReferences(workspace.path, file.path).catch(() => []),
          scanRoot
            ? window.entropy.fs.findDuplicates(scanRoot, file.path).catch(() => [])
            : Promise.resolve([]),
        ]);
        next[file.path] = { noteRefs: noteRefs.length, duplicates: duplicates.length };
      }
      if (!cancelled) setRelationFlags(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFilters, sizedEntries, workspace.path, scanRoot]);

  function toggleFilter(id: InventoryFilterId): void {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    if (entry.isDirectory) {
      goToFolder(entry.path);
      return;
    }
    setSelected(entry);
    addRecentFile(entry.path);
    visitPreview(entry.path, workspace.currentFolder);
  }

  function selectRoot(root: InventoryRoot): void {
    setScanRoot(root.path);
    goToFolder(root.path, "replace");
  }

  async function handleRename(entry: FileEntry): Promise<void> {
    const nextName = window.prompt("Rename", entry.name)?.trim();
    if (!nextName || nextName === entry.name) return;

    try {
      const dir = await window.entropy.fs.dirname(entry.path);
      const target = await window.entropy.fs.join(dir, nextName);
      if (await window.entropy.fs.exists(target)) {
        setError("A file with that name already exists.");
        return;
      }
      await window.entropy.fs.rename(entry.path, target);
      await refresh();
      setSelected(await window.entropy.fs.stat(target));
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
    return [
      ...buildEntryActions({
        canReference: true,
        onRename: () => void handleRename(entry),
        onReference: () => referenceInNote(entry.path),
        onCopyPath: () => void copyPath(entry.path),
        onReveal: () => void revealPath(entry.path),
        onMoveTo: () => setMovingEntry(entry),
        onDelete: () => requestDelete(entry),
      }),
      {
        label: "Open",
        onSelect: () => void window.entropy.fs.openExternal(entry.path),
      },
      { label: "Duplicate", onSelect: () => void handleDuplicate(entry) },
    ];
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col" aria-label="File Inventory">
      <div className="min-h-0 flex-1">
        <ThreeColumnLayout
          id="inventory-layout-v3"
          variant="inventory"
          persistLayout={workspace.currentSection === "inventory"}
          sidebar={null}
          context={
            <StorageTreemap
              scan={treemapScan}
              selectedPath={selected?.path ?? pendingSelectPath}
              scanning={scanningTreemap}
              workspacePath={workspace.path}
              scanRoot={scanRoot}
              recentFiles={workspace.recentFiles}
              onSelect={(leaf) => void selectTreemapLeaf(leaf)}
              onOpen={(leaf) => void selectTreemapLeaf(leaf, true)}
              onZoom={(leaf) => void zoomTreemapFolder(leaf)}
            />
          }
          main={
            <section
              className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background"
              onDragOver={(event) => onDragOver(event, workspace.currentFolder)}
              onDrop={(event) => void onDrop(event, workspace.currentFolder)}
            >
              <div className="entropy-toolbar px-4 py-3">
                <Select
                  value={activeRoot?.path ?? scanRoot}
                  onValueChange={(value) => {
                    const root = roots.find((item) => item.path === value);
                    if (root) {
                      selectRoot(root);
                      return;
                    }
                    const mount = mountRoots.find((item) => item.path === value);
                    if (mount) {
                      addMountRoot(mount);
                      return;
                    }
                    selectRootPath(value);
                  }}
                >
                  <SelectTrigger className="h-8 w-[7.5rem] shrink-0 sm:w-[8.25rem]" aria-label="Location">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {roots.map((root) => (
                      <SelectItem key={root.id} value={root.path}>
                        {root.name}
                      </SelectItem>
                    ))}
                    {mountRoots.length > 0 ? (
                      <>
                        {mountRoots.map((mount) => (
                          <SelectItem key={mount.id} value={mount.path}>
                            Add {mount.name}…
                          </SelectItem>
                        ))}
                      </>
                    ) : null}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label="Add folder"
                      onClick={() => void addFolderRoot()}
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.75} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add folder…</TooltipContent>
                </Tooltip>
                <Input
                  type="search"
                  placeholder="Filter…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Filter files"
                  className="h-8 w-full max-w-[9rem] border-border bg-transparent sm:max-w-[11rem]"
                />
                <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                  <SelectTrigger className="h-8 w-[6.5rem] shrink-0" aria-label="Sort by">
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
                      onClick={() =>
                        updateSettings({ filesView: view === "list" ? "grid" : "list" })
                      }
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

              <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2">
                {INVENTORY_FILTERS.map((filter) => {
                  const on = activeFilters.has(filter.id);
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      aria-pressed={on}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] transition-colors",
                        on
                          ? "bg-ink-2 text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                      onClick={() => toggleFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  );
                })}
                {activeFilters.size > 0 ? (
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setActiveFilters(new Set())}
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="entropy-gallery px-4 pb-6">
                  {error ? <p className="mb-3 text-xs text-muted-foreground">{error}</p> : null}

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
                      <div className="entropy-gallery-grid">
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
                    <div className="entropy-gallery-grid">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="aspect-square w-full rounded-xl" />
                      ))}
                    </div>
                  ) : null}
                  {!loading && visible.length === 0 ? (
                    <Empty className="py-16">
                      <EmptyTitle>This folder is empty</EmptyTitle>
                      <EmptyDescription>
                        Drop files here or choose another location from the menu.
                      </EmptyDescription>
                    </Empty>
                  ) : null}

                  {!loading && visible.length > 0 ? (
                    <div className="mb-3">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Gallery
                      </h2>
                    </div>
                  ) : null}

                  {view === "list" ? (
                    <div className="space-y-0.5" role="table" aria-label="Files">
                      <div
                        className="entropy-list-table px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                        role="row"
                      >
                        <span>Name</span>
                        <span className="entropy-list-hide-narrow">Modified</span>
                        <span>Size</span>
                        <span className="entropy-list-hide-narrow">Type</span>
                        <span className="sr-only">Actions</span>
                      </div>
                      {rendered.map((entry) => (
                        <div
                          key={entry.path}
                          role="row"
                          draggable
                          className={cn(
                            "entropy-list-table w-full rounded-lg px-2 py-1.5 text-sm hover:bg-accent",
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
                          <span className="entropy-list-hide-narrow truncate text-xs text-muted-foreground">
                            {formatDate(entry.modifiedAt)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(entry.size)}
                          </span>
                          <span className="entropy-list-hide-narrow text-xs text-muted-foreground">
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
                    <div className="entropy-gallery-grid">
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
              {selected ? (
                <InventoryContextBar
                  selected={selected}
                  scanRoot={scanRoot}
                  onOpenExternal={() => void window.entropy.fs.openExternal(selected.path)}
                  onReveal={() => void revealPath(selected.path)}
                  onReference={() => referenceInNote(selected.path)}
                />
              ) : null}
            </section>
          }
        />
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
      <MoveToDialog
        open={movingEntry !== null}
        rootPath={scanRoot || workspace.currentFolder}
        rootName={rootLabel}
        excludePath={movingEntry?.path ?? workspace.currentFolder}
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
  const isMedia = isMediaEntry(entry);
  const [face, setFace] = useState<"loading" | "preview" | "icon">(
    entry.isDirectory || isMedia ? "loading" : "icon",
  );

  useEffect(() => {
    if (isMedia) {
      setFace("preview");
      return;
    }
    if (!entry.isDirectory) {
      setFace("icon");
      return;
    }
    let cancelled = false;
    setFace("loading");
    void getFolderPreview(entry.path).then((data) => {
      if (!cancelled) setFace(data.media.length > 0 ? "preview" : "icon");
    });
    return () => {
      cancelled = true;
    };
  }, [entry.isDirectory, entry.path, isMedia]);

  return (
    <div
      draggable
      className={cn("entropy-gallery-card group cursor-pointer", dropTarget && "opacity-70")}
      onClick={onOpen}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={cn(
          "entropy-gallery-face",
          face === "preview" && "entropy-media-card rounded-xl",
          face === "icon" && "entropy-gallery-face--icon",
          face === "loading" && "rounded-xl bg-ink-2/50",
          selected && face === "preview" && "outline outline-1 outline-offset-2 outline-ring",
          selected && face === "icon" && "rounded-xl ring-1 ring-ring",
        )}
      >
        {face === "icon" ? (
          entry.isDirectory ? (
            <Folder className="text-muted-foreground/75" strokeWidth={1.15} />
          ) : (
            <FileText className="text-muted-foreground/75" strokeWidth={1.15} />
          )
        ) : face === "preview" ? (
          <EntryPreview entry={entry} size="lg" />
        ) : null}
      </div>

      <div className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="entropy-gallery-label" title={entry.name}>
            {entry.name}
          </p>
          {entry.isDirectory ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              <span>{count == null ? "…" : `${count.toLocaleString()} items`}</span>
              {entry.size > 0 ? (
                <>
                  <span className="mx-1 text-border">·</span>
                  <span>{formatBytes(entry.size)}</span>
                </>
              ) : null}
            </p>
          ) : entry.size > 0 ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {formatBytes(entry.size)}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <ItemActionsMenu label={entry.name} actions={actions} />
        </div>
      </div>
    </div>
  );
});
