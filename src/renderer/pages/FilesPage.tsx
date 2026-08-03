import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, memo } from "react";
import { flushSync } from "react-dom";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Copy,
  FileText,
  Folder,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { FileEntry, InventoryRoot, TreemapFileLeaf, TreemapScanResult } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { StatusBar } from "../components/StatusBar";
import { ItemActionsMenu, type ItemAction } from "../components/ItemActionsMenu";
import {
  EntryPreview,
  getFolderPreview,
  invalidateFolderPreview,
  useFolderCount,
} from "../components/EntryPreview";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MoveToDialog } from "../components/MoveToDialog";
import { TrashUndoBar } from "../components/TrashUndoBar";
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
import { InventoryBreadcrumb } from "../components/InventoryBreadcrumb";
import { InventoryDuplicatesPanel } from "../components/InventoryDuplicatesPanel";
import { buildEntryActions, copyPath, moveEntryToFolder, revealPath } from "../lib/itemActions";
import { isPreviewableEntry } from "../lib/media";
import { withMediaReleased } from "../lib/mediaRelease";
import { formatBytes } from "../lib/format";
import { useDirWatch } from "../hooks/useDirWatch";
import { isUnderPath, osTrashName, samePath, hostPlatform } from "../lib/platform";
import { isProtectedOsPath, protectedPathMessage } from "../../shared/protectedPaths";
import { cn } from "../lib/utils";

type SortKey = "name" | "modified" | "size" | "type";

function pickRoot(folder: string, roots: InventoryRoot[]): InventoryRoot | null {
  const matches = roots.filter((root) => isUnderPath(folder, root.path));
  matches.sort((a, b) => b.path.length - a.path.length);
  return matches[0] ?? null;
}

export function FilesPage() {
  const {
    workspace,
    addRecentFile,
    goToFolder,
    setInventoryRoot,
    bootstrapInventoryFolder,
    visitPreview,
    openNote,
    referenceInNote,
    updateSettings,
  } = useWorkspace();
  const [roots, setRoots] = useState<InventoryRoot[]>([]);
  const [scanRoot, setScanRoot] = useState<string>("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [sizeByPath, setSizeByPath] = useState<Record<string, number>>({});
  const [treemapScan, setTreemapScan] = useState<TreemapScanResult | null>(null);
  const [scanningTreemap, setScanningTreemap] = useState(false);
  const [pendingSelectPath, setPendingSelectPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FileEntry | null>(null);
  const [undoTrash, setUndoTrash] = useState<{ paths: string[]; name: string; size: number } | null>(
    null,
  );
  const [undoBusy, setUndoBusy] = useState(false);
  const [movingEntry, setMovingEntry] = useState<FileEntry | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [duplicatesMode, setDuplicatesMode] = useState(false);
  const [renderedCount, setRenderedCount] = useState(60);
  /** Bumps when the open folder changes on disk so sizes/treemap stay current. */
  const [diskEpoch, setDiskEpoch] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const homeBootstrapped = useRef(false);

  useEffect(() => {
    setDuplicatesMode(false);
  }, [workspace.currentFolder]);

  const activeRoot = pickRoot(workspace.currentFolder, roots) ?? roots[0] ?? null;
  const rootLabel = activeRoot?.name ?? "Home";
  const treemapCollapsed = workspace.settings.inventoryTreemapCollapsed;

  const refreshListing = useCallback(async (options?: { quiet?: boolean }) => {
    if (!workspace.currentFolder) return;
    const quiet = Boolean(options?.quiet);
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const listing = await window.entropy.fs.listDir(workspace.currentFolder);
      setEntries(listing);
      setSelected((current) => {
        if (!current) return null;
        return listing.find((entry) => entry.path === current.path) ?? null;
      });
      if (quiet) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read folder");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [workspace.currentFolder]);

  const refresh = useCallback(async () => {
    await refreshListing({ quiet: true });
    setDiskEpoch((value) => value + 1);
  }, [refreshListing]);

  useDirWatch(
    workspace.currentFolder,
    () => {
      invalidateFolderPreview(workspace.currentFolder);
      void refreshListing({ quiet: true });
      setDiskEpoch((value) => value + 1);
    },
    {
      // Nested creates/deletes under the open folder must refresh gallery + treemap.
      recursive: true,
      enabled: Boolean(workspace.currentFolder),
    },
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const extra = workspace.settings.inventoryExtraRoots ?? [];
        const nextRoots = await window.entropy.fs.getInventoryRoots(extra);
        if (cancelled) return;
        setRoots(nextRoots);
        const home =
          nextRoots.find((root) => root.id === "home")?.path ??
          (await window.entropy.fs.getHomePath());
        if (!homeBootstrapped.current) {
          homeBootstrapped.current = true;
          const homeRoot = nextRoots.find((root) => root.id === "home");
          const label = homeRoot?.name ?? "Home";
          setScanRoot(home);
          if (samePath(workspace.currentFolder, workspace.path) || !workspace.currentFolder) {
            bootstrapInventoryFolder(home, label);
          } else {
            const match = pickRoot(workspace.currentFolder, nextRoots);
            const rootPath = match?.path ?? home;
            setScanRoot(rootPath);
            bootstrapInventoryFolder(
              workspace.currentFolder,
              match?.name ?? label,
              rootPath,
            );
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

  useEffect(() => {
    if (!roots.length || !workspace.currentFolder) return;
    const home = roots.find((root) => root.id === "home");
    // Stay anchored to Home while browsing under it so crumbs stay Home > Desktop > …
    // Named shortcuts (Desktop, Downloads, …) must not steal the breadcrumb root.
    if (home && isUnderPath(workspace.currentFolder, home.path)) {
      if (!samePath(home.path, scanRoot)) setScanRoot(home.path);
      return;
    }
    const match = pickRoot(workspace.currentFolder, roots);
    if (match && !samePath(match.path, scanRoot)) {
      setScanRoot(match.path);
    }
  }, [roots, scanRoot, workspace.currentFolder]);

  useEffect(() => {
    if (!scanRoot) return;
    const home = roots.find((root) => root.id === "home");
    const label =
      home && samePath(scanRoot, home.path)
        ? home.name
        : (roots.find((root) => samePath(root.path, scanRoot))?.name ??
          activeRoot?.name ??
          "Home");
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
  }, [workspace.currentFolder, workspace.currentSection, diskEpoch]);

  useEffect(() => {
    if (workspace.currentSection !== "inventory" || !workspace.currentFolder) return;
    if (treemapCollapsed) {
      setScanningTreemap(false);
      return;
    }
    let cancelled = false;
    // Keep the previous map visible while refreshing so the panel doesn't flash empty.
    if (!treemapScan) setScanningTreemap(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preserve prior map during epoch refresh
  }, [workspace.currentFolder, workspace.currentSection, diskEpoch, treemapCollapsed]);

  useEffect(() => {
    if (!pendingSelectPath || loading) return;
    const match = entries.find((entry) => entry.path === pendingSelectPath);
    if (match) {
      setSelected(match);
      setPendingSelectPath(null);
      return;
    }
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

  const sizedEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        size: sizeByPath[entry.path] ?? entry.size,
      })),
    [entries, sizeByPath],
  );

  const visible = useMemo(() => {
    return [...sizedEntries].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sortKey === "modified") cmp = a.modifiedAt - b.modifiedAt;
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "type") cmp = a.extension.localeCompare(b.extension);
      return sortAsc ? cmp : -cmp;
    });
  }, [sizedEntries, sortAsc, sortKey]);

  const rendered = useMemo(
    () => visible.slice(0, renderedCount),
    [visible, renderedCount],
  );

  useEffect(() => {
    setRenderedCount(60);
  }, [workspace.currentFolder]);

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
  }, [visible.length, rendered.length, loading]);

  async function openEntry(entry: FileEntry): Promise<void> {
    if (entry.isDirectory) {
      goToFolder(entry.path);
      return;
    }
    setSelected(entry);
    addRecentFile(entry.path);
    visitPreview(entry.path, workspace.currentFolder);
  }

  async function handleRename(entry: FileEntry): Promise<void> {
    if (isProtectedOsPath(entry.path, hostPlatform())) {
      setError(protectedPathMessage(entry.path, "rename"));
      return;
    }
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
    if (isProtectedOsPath(entry.path, hostPlatform())) {
      setError(protectedPathMessage(entry.path, "delete"));
      return;
    }
    // Single files: trash immediately — Undo bar is enough. Folders still confirm.
    if (!entry.isDirectory) {
      void trashEntry(entry);
      return;
    }
    setPendingDelete(entry);
  }

  async function trashEntry(entry: FileEntry): Promise<void> {
    const targetPath = entry.path;
    if (isProtectedOsPath(targetPath, hostPlatform())) {
      setError(protectedPathMessage(targetPath, "delete"));
      return;
    }
    try {
      // Commit unmount of this card's video before Windows tries Recycle Bin.
      flushSync(() => {
        if (selected && samePath(selected.path, targetPath)) setSelected(null);
        setEntries((prev) => prev.filter((item) => !samePath(item.path, targetPath)));
        setSizeByPath((prev) => {
          const key = Object.keys(prev).find((item) => samePath(item, targetPath));
          if (!key) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      });

      await withMediaReleased(targetPath, () => window.entropy.fs.remove(targetPath));
      setUndoTrash({ paths: [targetPath], name: entry.name, size: entry.size });
      setError(null);
      const parent = await window.entropy.fs.dirname(targetPath).catch(() => "");
      if (parent) invalidateFolderPreview(parent);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      await refresh();
    }
  }

  async function confirmDelete(): Promise<void> {
    const entry = pendingDelete;
    if (!entry) return;
    setPendingDelete(null);
    await trashEntry(entry);
  }

  async function undoTrashAction(): Promise<void> {
    if (!undoTrash) return;
    setUndoBusy(true);
    try {
      const result = await window.entropy.fs.undoRemove(undoTrash.paths);
      if (result.restored > 0) {
        setUndoTrash(null);
        await refresh();
      } else {
        setError(
          `Could not restore automatically — open ${osTrashName()} to recover the file.`,
        );
        void window.entropy.fs.openTrash();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setUndoBusy(false);
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
    const platform = hostPlatform();
    if (isProtectedOsPath(entry.path, platform)) {
      setError(protectedPathMessage(entry.path, "move"));
      return;
    }
    if (isProtectedOsPath(destinationFolder, platform)) {
      setError(protectedPathMessage(destinationFolder, "move into"));
      return;
    }
    try {
      const target = await moveEntryToFolder(entry.path, destinationFolder);
      await refresh();
      setSelected(await window.entropy.fs.stat(target));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move");
    }
  }

  function fileActions(entry: FileEntry): ItemAction[] {
    return [
      ...buildEntryActions({
        canReference: !entry.isDirectory,
        referenceLabel: "Add to Workspace",
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
        {duplicatesMode ? (
          <InventoryDuplicatesPanel
            rootPath={workspace.currentFolder}
            onBack={() => setDuplicatesMode(false)}
          />
        ) : (
        <ThreeColumnLayout
          id="inventory-layout-v3"
          variant="inventory"
          persistLayout={workspace.currentSection === "inventory"}
          sidebar={null}
          context={
            treemapCollapsed ? null : (
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
            )
          }
          main={
            <section
              className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background"
              onDragOver={(event) => onDragOver(event, workspace.currentFolder)}
              onDrop={(event) => void onDrop(event, workspace.currentFolder)}
            >
              <div className="entropy-chrome-bar entropy-toolbar entropy-inventory-chrome">
                <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                  <SelectTrigger
                    className="entropy-sort-trigger h-8 w-[7.5rem] shrink-0"
                    aria-label="Sort by"
                  >
                    <SelectValue placeholder="Sort by" />
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
                      onClick={() => setSortAsc((value) => !value)}
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
                      size="sm"
                      className="entropy-duplicates-btn h-8 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground"
                      onClick={() => setDuplicatesMode(true)}
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span className="entropy-duplicates-label">Duplicates</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Find exact duplicate files in this location</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "ml-auto h-8 w-8 text-muted-foreground",
                        !treemapCollapsed && "bg-ink-2 text-paper",
                      )}
                      aria-label={treemapCollapsed ? "Show size map" : "Hide size map"}
                      aria-pressed={!treemapCollapsed}
                      onClick={() =>
                        updateSettings({
                          inventoryTreemapCollapsed: !treemapCollapsed,
                        })
                      }
                    >
                      {treemapCollapsed ? (
                        <PanelRightOpen className="h-4 w-4" strokeWidth={1.75} />
                      ) : (
                        <PanelRightClose className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {treemapCollapsed ? "Show size map" : "Hide size map"}
                  </TooltipContent>
                </Tooltip>
              </div>

              <InventoryBreadcrumb />

              <ScrollArea className="min-h-0 flex-1" type="hover">
                <div className="entropy-gallery px-4 py-4 pb-6">
                  {error ? <p className="mb-3 text-sm text-muted-foreground">{error}</p> : null}

                  {loading ? (
                    <div className="entropy-gallery-grid">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="aspect-square w-full rounded-xl" />
                      ))}
                    </div>
                  ) : null}

                  {!loading && visible.length === 0 ? (
                    <Empty className="py-16">
                      <EmptyTitle>Nothing here yet</EmptyTitle>
                      <EmptyDescription>
                        Drop files into this folder, or pick another path above.
                      </EmptyDescription>
                    </Empty>
                  ) : null}

                  {!loading && visible.length > 0 ? (
                    <div className="entropy-gallery-grid">
                      {rendered.map((entry) => (
                        <FileGridCard
                          key={entry.path}
                          entry={entry}
                          selected={selected?.path === entry.path}
                          dropTarget={entry.isDirectory && dragOverPath === entry.path}
                          sizePending={
                            entry.isDirectory && sizeByPath[entry.path] === undefined
                          }
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
                  ) : null}
                </div>
              </ScrollArea>
              {selected ? (
                <InventoryContextBar
                  selected={selected}
                  scanRoot={scanRoot}
                  onOpenExternal={() => void window.entropy.fs.openExternal(selected.path)}
                  onReveal={() => void revealPath(selected.path)}
                  onAddToWorkspace={() => referenceInNote(selected.path)}
                  onOpenNote={openNote}
                />
              ) : null}
            </section>
          }
        />
        )}
      </div>
      {!duplicatesMode ? (
        <>
          {undoTrash ? (
            <TrashUndoBar
              fileCount={1}
              reclaimLabel={formatBytes(undoTrash.size)}
              busy={undoBusy}
              onUndo={() => void undoTrashAction()}
              onOpenTrash={() => void window.entropy.fs.openTrash()}
              onDismiss={() => setUndoTrash(null)}
            />
          ) : null}
          <StatusBar
            left={workspace.currentFolder}
            right={`${visible.length} items`}
          />
        </>
      ) : null}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Move “${pendingDelete.name}”?` : "Move folder?"}
        description={`Moves the folder and everything inside to ${osTrashName()}. Recover until emptied.`}
        confirmLabel="Move"
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

const FileGridCard = memo(
  function FileGridCard({
    entry,
    selected,
    dropTarget,
    sizePending,
    onOpen,
    onDragStart,
    onDragOver,
    onDrop,
    actions,
  }: {
    entry: FileEntry;
    selected: boolean;
    dropTarget: boolean;
    sizePending: boolean;
    onOpen: () => void;
    onDragStart: (event: DragEvent) => void;
    onDragOver?: (event: DragEvent) => void;
    onDrop?: (event: DragEvent) => void;
    actions: ItemAction[];
  }) {
  const count = useFolderCount(entry.path, entry.isDirectory);
  const isPreviewable = isPreviewableEntry(entry);
  const [face, setFace] = useState<"loading" | "preview" | "icon">(
    entry.isDirectory || isPreviewable ? "loading" : "icon",
  );

  useEffect(() => {
    if (isPreviewable) {
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
  }, [entry.isDirectory, entry.path, isPreviewable]);

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
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              <span className="text-foreground/80">
                {sizePending ? "…" : formatBytes(entry.size)}
              </span>
              <span className="mx-1 text-border">·</span>
              <span>{count == null ? "…" : `${count.toLocaleString()} items`}</span>
            </p>
          ) : entry.size > 0 ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {formatBytes(entry.size)}
            </p>
          ) : null}
        </div>
        <div
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
          <ItemActionsMenu label={entry.name} actions={actions} />
        </div>
      </div>
    </div>
  );
  },
  (prev, next) =>
    prev.entry.path === next.entry.path &&
    prev.entry.name === next.entry.name &&
    prev.entry.size === next.entry.size &&
    prev.entry.modifiedAt === next.entry.modifiedAt &&
    prev.entry.isDirectory === next.entry.isDirectory &&
    prev.selected === next.selected &&
    prev.dropTarget === next.dropTarget &&
    prev.sizePending === next.sizePending,
);
