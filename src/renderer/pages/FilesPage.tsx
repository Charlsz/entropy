import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, memo } from "react";
import { flushSync } from "react-dom";
import { FileText, Folder, Image, ListFilter } from "lucide-react";
import type { FileEntry, InventoryRoot } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
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
import { ThreeColumnLayout } from "../components/ThreeColumnLayout";
import { InventoryBreadcrumb } from "../components/InventoryBreadcrumb";
import { InventoryDuplicatesPanel } from "../components/InventoryDuplicatesPanel";
import { FileIntelligencePanel } from "../components/FileIntelligencePanel";
import { IntelligenceComingSoon } from "../components/IntelligenceComingSoon";
import { buildEntryActions, copyPath, moveEntryToFolder, revealPath } from "../lib/itemActions";
import { isMediaEntry, isPreviewableEntry, mediaKind } from "../lib/media";
import { withMediaReleased } from "../lib/mediaRelease";
import { formatBytes, formatModifiedLabel, formatUserPath } from "../lib/format";
import { useDirWatch } from "../hooks/useDirWatch";
import { isUnderPath, osTrashName, samePath, hostPlatform } from "../lib/platform";
import { isProtectedOsPath, protectedPathMessage } from "../../shared/protectedPaths";
import { figma } from "../lib/figmaTokens";
import { cn } from "../lib/utils";
import {
  LARGE_FILE_BYTES,
  PERSPECTIVE_LABELS,
  type LibraryPerspective,
} from "../types/library";

type SortKey = "name" | "modified" | "size" | "type";

const GALLERY_CHIPS: LibraryPerspective[] = ["folders", "gallery", "large-files", "duplicates"];

function pickRoot(folder: string, roots: InventoryRoot[]): InventoryRoot | null {
  const matches = roots.filter((root) => isUnderPath(folder, root.path));
  matches.sort((a, b) => b.path.length - a.path.length);
  return matches[0] ?? null;
}

function parentFolderPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized.startsWith("/") ? "/" : filePath;
  const parent = normalized.slice(0, idx);
  // Preserve original separators for display/formatUserPath.
  if (filePath.includes("\\") && !filePath.includes("/")) {
    return parent.replace(/\//g, "\\");
  }
  return parent;
}

function EntryTypeIcon({ entry }: { entry: FileEntry }) {
  if (entry.isDirectory) {
    return <Folder className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />;
  }
  if (mediaKind(entry.extension) === "image") {
    return <Image className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />;
  }
  return <FileText className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />;
}

export function FilesPage() {
  const {
    workspace,
    addRecentFile,
    goToFolder,
    setInventoryRoot,
    bootstrapInventoryFolder,
    visitPreview,
    referenceInNote,
    updateSettings,
  } = useWorkspace();
  const [roots, setRoots] = useState<InventoryRoot[]>([]);
  const [scanRoot, setScanRoot] = useState<string>("");
  const [homePath, setHomePath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [sizeByPath, setSizeByPath] = useState<Record<string, number>>({});
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
  const [recentEntries, setRecentEntries] = useState<FileEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [renderedCount, setRenderedCount] = useState(60);
  /** Bumps when the open folder changes on disk so sizes stay current. */
  const [diskEpoch, setDiskEpoch] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const homeBootstrapped = useRef(false);

  const perspective = workspace.settings.libraryPerspective ?? "folders";
  const intelligenceView = workspace.settings.intelligenceView ?? null;
  const activeRoot = pickRoot(workspace.currentFolder, roots) ?? roots[0] ?? null;
  const rootLabel = activeRoot?.name ?? "Home";

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
      recursive: true,
      enabled: Boolean(workspace.currentFolder) && !intelligenceView && perspective !== "duplicates",
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
        setHomePath(home);
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
  }, [workspace.currentFolder, perspective]);

  useEffect(() => {
    if (!workspace.inventoryFocusPath) return;
    setPendingSelectPath(workspace.inventoryFocusPath);
  }, [workspace.inventoryFocusPath]);

  useEffect(() => {
    if (workspace.currentSection !== "inventory" || !workspace.currentFolder) return;
    if (intelligenceView || perspective === "duplicates" || perspective === "recent") return;
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
  }, [
    workspace.currentFolder,
    workspace.currentSection,
    diskEpoch,
    intelligenceView,
    perspective,
  ]);

  useEffect(() => {
    if (perspective !== "recent" || intelligenceView) {
      setRecentEntries([]);
      return;
    }
    let cancelled = false;
    setRecentLoading(true);
    void (async () => {
      const results: FileEntry[] = [];
      for (const path of workspace.recentFiles) {
        try {
          const info = await window.entropy.fs.stat(path);
          results.push(info);
        } catch {
          // File may have been removed.
        }
      }
      if (!cancelled) {
        setRecentEntries(results);
        setRecentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [perspective, intelligenceView, workspace.recentFiles, diskEpoch]);

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

  const sizedEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        size: sizeByPath[entry.path] ?? entry.size,
      })),
    [entries, sizeByPath],
  );

  const folderVisible = useMemo(() => {
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

  const largeFileVisible = useMemo(() => {
    return folderVisible.filter((entry) => !entry.isDirectory && entry.size >= LARGE_FILE_BYTES);
  }, [folderVisible]);

  const galleryVisible = useMemo(() => {
    const media = folderVisible.filter((entry) => isMediaEntry(entry));
    const source =
      media.length > 0
        ? media
        : folderVisible.filter((entry) => !entry.isDirectory);
    return [...source].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sortKey === "modified") cmp = a.modifiedAt - b.modifiedAt;
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "type") cmp = a.extension.localeCompare(b.extension);
      return sortAsc ? cmp : -cmp;
    });
  }, [folderVisible, sortAsc, sortKey]);

  const recentVisible = useMemo(() => {
    return [...recentEntries].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sortKey === "modified") cmp = a.modifiedAt - b.modifiedAt;
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "type") cmp = a.extension.localeCompare(b.extension);
      return sortAsc ? cmp : -cmp;
    });
  }, [recentEntries, sortAsc, sortKey]);

  const tableEntries =
    perspective === "large-files"
      ? largeFileVisible
      : perspective === "recent"
        ? recentVisible
        : folderVisible;

  const listLoading = perspective === "recent" ? recentLoading : loading;

  const rendered = useMemo(
    () => galleryVisible.slice(0, renderedCount),
    [galleryVisible, renderedCount],
  );

  useEffect(() => {
    setRenderedCount(60);
  }, [workspace.currentFolder, perspective]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || listLoading || rendered.length >= galleryVisible.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setRenderedCount((count) => Math.min(count + 60, galleryVisible.length));
      },
      { root: null, rootMargin: "320px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [galleryVisible.length, rendered.length, listLoading]);

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
        setRecentEntries((prev) => prev.filter((item) => !samePath(item.path, targetPath)));
        setSizeByPath((prev) => {
          const key = Object.keys(prev).find((item) => samePath(item, targetPath));
          if (!key) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      });

      if (undoTrash) {
        await window.entropy.fs.finalizeTrash(undoTrash.paths);
        setUndoTrash(null);
      }

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
        setError(`Couldn't restore the file. It may already be gone from ${osTrashName()}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setUndoBusy(false);
    }
  }

  async function dismissTrashUndo(): Promise<void> {
    if (!undoTrash) return;
    const paths = undoTrash.paths;
    setUndoTrash(null);
    await window.entropy.fs.finalizeTrash(paths).catch(() => undefined);
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

  function cycleSort(): void {
    const keys: SortKey[] = ["name", "modified", "size", "type"];
    const index = keys.indexOf(sortKey);
    setSortKey(keys[(index + 1) % keys.length] ?? "name");
    setSortAsc(true);
  }

  const sortLabel =
    sortKey === "name"
      ? "Name"
      : sortKey === "modified"
        ? "Modified"
        : sortKey === "size"
          ? "Size"
          : "Type";

  function renderFileTable(rows: FileEntry[], emptyTitle: string, emptyBody: string) {
    return (
      <>
        <div
          className="flex shrink-0 items-start gap-4 px-6 py-2.5 text-[11px] font-semibold"
          style={{ backgroundColor: figma.surface, borderBottom: `1px solid ${figma.border}`, color: figma.muted }}
        >
          <span className="w-[260px] shrink-0">Name</span>
          <span className="min-w-0 flex-1">Path</span>
          <span className="w-20 shrink-0 text-right">Size</span>
          <span className="w-[140px] shrink-0 text-right">Last Modified</span>
        </div>
        <ScrollArea className="min-h-0 flex-1" type="hover">
          <div>
            {error ? (
              <p className="px-6 py-3 text-[13px]" style={{ color: figma.muted }}>
                {error}
              </p>
            ) : null}

            {listLoading ? (
              <div className="flex flex-col gap-1 px-6 py-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : null}

            {!listLoading && rows.length === 0 ? (
              <Empty className="py-16">
                <EmptyTitle>{emptyTitle}</EmptyTitle>
                <EmptyDescription>{emptyBody}</EmptyDescription>
              </Empty>
            ) : null}

            {!listLoading && rows.length > 0
              ? rows.map((entry) => {
                  const parentPath = parentFolderPath(entry.path);
                  const pathLabel = formatUserPath(parentPath, homePath);
                  const sizePending =
                    entry.isDirectory && sizeByPath[entry.path] === undefined;
                  const selectedRow = selected?.path === entry.path;
                  return (
                    <div
                      key={entry.path}
                      draggable
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "group relative flex cursor-pointer items-center gap-4 border-b px-6 py-2 text-[13px]",
                        entry.isDirectory && dragOverPath === entry.path && "opacity-70",
                      )}
                      style={{
                        borderColor: figma.border,
                        backgroundColor: selectedRow ? figma.select : "transparent",
                        color: figma.ink,
                      }}
                      onClick={() => setSelected(entry)}
                      onDoubleClick={() => void openEntry(entry)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void openEntry(entry);
                      }}
                      onDragStart={(event) => onDragStart(event, entry)}
                      onDragOver={
                        entry.isDirectory ? (event) => onDragOver(event, entry.path) : undefined
                      }
                      onDrop={
                        entry.isDirectory ? (event) => void onDrop(event, entry.path) : undefined
                      }
                    >
                      <div className="flex w-[260px] min-w-0 shrink-0 items-center gap-2.5">
                        <EntryTypeIcon entry={entry} />
                        <span
                          className={cn(
                            "truncate",
                            selectedRow ? "font-medium" : "font-normal",
                          )}
                          title={entry.name}
                        >
                          {entry.name}
                        </span>
                      </div>
                      <span
                        className="min-w-0 flex-1 truncate font-mono text-[12px]"
                        style={{ color: figma.muted }}
                        title={pathLabel}
                      >
                        {pathLabel}
                      </span>
                      <span
                        className="w-20 shrink-0 text-right font-mono text-[12px]"
                        style={{ color: figma.muted }}
                      >
                        {sizePending ? "…" : formatBytes(entry.size)}
                      </span>
                      <span
                        className="w-[140px] shrink-0 text-right text-[12px]"
                        style={{ color: figma.muted }}
                      >
                        {formatModifiedLabel(entry.modifiedAt)}
                      </span>
                      <div
                        className="absolute right-3 opacity-0 group-hover:opacity-100"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ItemActionsMenu label={entry.name} actions={fileActions(entry)} />
                      </div>
                    </div>
                  );
                })
              : null}
          </div>
        </ScrollArea>
      </>
    );
  }

  function renderGallery() {
    return (
      <>
        <InventoryBreadcrumb trailing="Gallery Perspective" />
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-6 py-2.5">
          {GALLERY_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs transition-colors duration-150",
                perspective === chip
                  ? "bg-select font-medium text-foreground"
                  : "text-muted-foreground hover:bg-panel hover:text-foreground",
              )}
              onClick={() => updateSettings({ libraryPerspective: chip, intelligenceView: null })}
            >
              {PERSPECTIVE_LABELS[chip]}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Sort by: {sortLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Change sort"
              onClick={cycleSort}
            >
              <ListFilter className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1" type="hover">
          <div className="px-6 py-4 pb-6">
            {error ? <p className="mb-3 text-sm text-muted-foreground">{error}</p> : null}

            {listLoading ? (
              <div className="flex flex-wrap content-start gap-5">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-[220px] w-[260px] rounded-lg" />
                ))}
              </div>
            ) : null}

            {!listLoading && galleryVisible.length === 0 ? (
              <Empty className="py-16">
                <EmptyTitle>No media here</EmptyTitle>
                <EmptyDescription>
                  Open a folder with images or video, or switch to Folders to browse everything.
                </EmptyDescription>
              </Empty>
            ) : null}

            {!listLoading && galleryVisible.length > 0 ? (
              <div className="flex flex-wrap content-start gap-5">
                {rendered.map((entry) => (
                  <FileGridCard
                    key={entry.path}
                    entry={entry}
                    homePath={homePath}
                    selected={selected?.path === entry.path}
                    dropTarget={false}
                    sizePending={false}
                    onSelect={() => setSelected(entry)}
                    onOpen={() => void openEntry(entry)}
                    onDragStart={(event) => onDragStart(event, entry)}
                    actions={fileActions(entry)}
                  />
                ))}
                {rendered.length < galleryVisible.length ? (
                  <div ref={loadMoreRef} className="h-8 w-full" aria-hidden />
                ) : null}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </>
    );
  }

  function renderMain() {
    if (perspective === "gallery") return renderGallery();

    if (perspective === "large-files") {
      return (
        <>
          <InventoryBreadcrumb />
          {renderFileTable(
            tableEntries,
            "No large files here",
            "Files over 100 MB in this folder will show up here.",
          )}
        </>
      );
    }

    if (perspective === "recent") {
      return (
        <>
          <InventoryBreadcrumb trailing="Recent" />
          {renderFileTable(
            tableEntries,
            "No recent files",
            "Files you open in Library will appear here.",
          )}
        </>
      );
    }

    return (
      <>
        <InventoryBreadcrumb />
        {renderFileTable(
          tableEntries,
          "Nothing here yet",
          "Drop files into this folder, or pick another path above.",
        )}
      </>
    );
  }

  const showChrome =
    !intelligenceView && perspective !== "duplicates";

  return (
    <div className="flex h-full min-h-0 w-full flex-col" aria-label="Library">
      <div className="min-h-0 flex-1">
        {intelligenceView ? (
          <IntelligenceComingSoon view={intelligenceView} />
        ) : perspective === "duplicates" ? (
          <InventoryDuplicatesPanel
            rootPath={workspace.currentFolder}
            onBack={() => updateSettings({ libraryPerspective: "folders" })}
          />
        ) : (
          <ThreeColumnLayout
            id="inventory-layout-v3"
            variant="inventory"
            persistLayout={workspace.currentSection === "inventory"}
            sidebar={null}
            context={
              selected ? (
                <FileIntelligencePanel entry={selected} scanRoot={scanRoot} />
              ) : null
            }
            main={
              <section
                className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
                style={{ backgroundColor: figma.canvas }}
                onDragOver={(event) => onDragOver(event, workspace.currentFolder)}
                onDrop={(event) => void onDrop(event, workspace.currentFolder)}
              >
                {renderMain()}
              </section>
            }
          />
        )}
      </div>
      {showChrome && undoTrash ? (
        <TrashUndoBar
          fileCount={1}
          reclaimLabel={formatBytes(undoTrash.size)}
          busy={undoBusy}
          onUndo={() => void undoTrashAction()}
          onDismiss={() => void dismissTrashUndo()}
        />
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
    homePath,
    selected,
    dropTarget,
    sizePending,
    onSelect,
    onOpen,
    onDragStart,
    onDragOver,
    onDrop,
    actions,
  }: {
    entry: FileEntry;
    homePath: string | null;
    selected: boolean;
    dropTarget: boolean;
    sizePending: boolean;
    onSelect: () => void;
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
    const pathLabel = formatUserPath(entry.path, homePath);

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
        className={cn("group w-[260px] shrink-0 cursor-pointer rounded-lg border p-2.5", dropTarget && "opacity-70")}
        style={{
          backgroundColor: figma.canvas,
          borderColor: figma.border,
          outline: selected ? `1px solid ${figma.accent}` : undefined,
        }}
        onClick={onSelect}
        onDoubleClick={onOpen}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div
          className={cn(
            "mb-2.5 h-40 w-full overflow-hidden rounded-[4px]",
            face === "icon" && "flex items-center justify-center",
          )}
          style={{ backgroundColor: figma.surface }}
        >
          {face === "icon" ? (
            entry.isDirectory ? (
              <Folder className="size-10" style={{ color: figma.muted }} strokeWidth={1.15} />
            ) : mediaKind(entry.extension) === "image" ? (
              <Image className="size-10" style={{ color: figma.muted }} strokeWidth={1.15} />
            ) : (
              <FileText className="size-10" style={{ color: figma.muted }} strokeWidth={1.15} />
            )
          ) : face === "preview" ? (
            <EntryPreview
              entry={entry}
              size="lg"
              className="aspect-auto h-full w-full rounded-[4px]"
            />
          ) : null}
        </div>

        <div className="flex min-w-0 items-start gap-1">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[13px] font-medium"
              style={{ color: figma.ink }}
              title={entry.name}
            >
              {entry.name}
            </p>
            <p
              className="mt-0.5 truncate font-mono text-[11px]"
              style={{ color: figma.muted }}
              title={pathLabel}
            >
              {entry.isDirectory ? (
                <>
                  {sizePending ? "…" : formatBytes(entry.size)}
                  <span className="mx-1">—</span>
                  {count == null ? "…" : `${count.toLocaleString()} items`}
                </>
              ) : (
                <>
                  {formatBytes(entry.size)}
                  <span className="mx-1">—</span>
                  {pathLabel}
                </>
              )}
            </p>
          </div>
          <div
            className="shrink-0 opacity-0 group-hover:opacity-100"
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
    prev.homePath === next.homePath &&
    prev.selected === next.selected &&
    prev.dropTarget === next.dropTarget &&
    prev.sizePending === next.sizePending,
);
