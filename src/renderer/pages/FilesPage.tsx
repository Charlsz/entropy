import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, memo } from "react";
import { flushSync } from "react-dom";
import {
  FileText,
  Folder,
  Image,
  ListFilter,
  RefreshCw,
} from "lucide-react";
import type {
  FileEntry,
  GlobalSearchHit,
  InventoryRoot,
  TreemapFileLeaf,
  TreemapScanResult,
} from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { type ItemAction } from "../components/ItemActionsMenu";
import { ItemContextMenu } from "../components/ItemContextMenu";
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
import { StorageTreemap, TreemapIcon } from "../components/StorageTreemap";
import { buildEntryActions, copyPath, moveEntryToFolder, revealPath } from "../lib/itemActions";
import { isMediaEntry, isPreviewableEntry, mediaKind } from "../lib/media";
import { withMediaReleased } from "../lib/mediaRelease";
import { formatBytes, formatModifiedLabel, formatUserPath } from "../lib/format";
import { fileReferenceClipboardMarkdown } from "../lib/markdownBlocks";
import {
  getLargeFilesCache,
  invalidateLargeFilesCache,
  largeFilesCacheKey,
  setLargeFilesCache,
  toLargeFileEntries,
} from "../lib/largeFilesCache";
import {
  getTreemapCache,
  invalidateTreemapCache,
  setTreemapCache,
  treemapCacheKey,
} from "../lib/treemapCache";
import { useDirWatch } from "../hooks/useDirWatch";
import { isUnderPath, osTrashName, samePath, hostPlatform } from "../lib/platform";
import { isProtectedOsPath, protectedPathMessage } from "../../shared/protectedPaths";
import { figma } from "../lib/figmaTokens";
import { cn } from "../lib/utils";
import { LARGE_FILE_BYTES, type LibraryPerspective } from "../types/library";

type SortKey = "name" | "modified" | "size" | "type";

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

function hitToFileEntry(hit: GlobalSearchHit): FileEntry {
  const extension =
    hit.source === "folder"
      ? ""
      : hit.name.includes(".")
        ? (hit.name.split(".").pop() ?? "")
        : "";
  return {
    name: hit.name,
    path: hit.path,
    isDirectory: hit.source === "folder",
    size: 0,
    modifiedAt: 0,
    extension,
  };
}

function normalizePerspective(value: string | undefined): LibraryPerspective {
  if (value === "gallery" || value === "large-files" || value === "duplicates") return value;
  return "folders";
}

export function FilesPage({
  searchQuery = "",
  onSearchQueryChange: _onSearchQueryChange,
}: {
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
} = {}) {
  const {
    workspace,
    addRecentFile,
    goToFolder,
    setInventoryRoot,
    bootstrapInventoryFolder,
    visitPreview,
    updateSettings,
    openInWorkspace,
    openNote,
    openFolder,
    openFileLocation,
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
  const [largeFileEntries, setLargeFileEntries] = useState<FileEntry[]>([]);
  const [largeFilesLoading, setLargeFilesLoading] = useState(false);
  /** Bumps only when the user presses Refresh on Large Files. */
  const [largeFilesScanId, setLargeFilesScanId] = useState(0);
  const [remoteSearchEntries, setRemoteSearchEntries] = useState<FileEntry[]>([]);
  const [searchHitMeta, setSearchHitMeta] = useState<Map<string, GlobalSearchHit>>(new Map());
  const [searchLoading, setSearchLoading] = useState(false);
  const [treemapScan, setTreemapScan] = useState<TreemapScanResult | null>(null);
  const [treemapScanning, setTreemapScanning] = useState(false);
  /** Bumps only when the user presses Refresh on the storage map. */
  const [treemapScanId, setTreemapScanId] = useState(0);
  const [renderedCount, setRenderedCount] = useState(60);
  /** Bumps when the open folder changes on disk so sizes stay current. */
  const [diskEpoch, setDiskEpoch] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const homeBootstrapped = useRef(false);

  const rawPerspective = workspace.settings.libraryPerspective ?? "folders";
  const perspective = normalizePerspective(rawPerspective as string);
  const intelligenceView = workspace.settings.intelligenceView ?? null;
  const treemapCollapsed = workspace.settings.inventoryTreemapCollapsed ?? true;
  const trimmedSearch = searchQuery.trim();
  const isSearching = trimmedSearch.length > 0;

  useEffect(() => {
    if ((rawPerspective as string) === "recent") {
      updateSettings({ libraryPerspective: "folders" });
    }
  }, [rawPerspective, updateSettings]);

  useEffect(() => {
    if (intelligenceView) {
      updateSettings({ intelligenceView: null });
    }
    // Clear retired Intelligence stubs from older sessions.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once when remnant is present
  }, [intelligenceView]);

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
    if (intelligenceView || perspective === "duplicates") return;
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

  // Large Files: load from cache when available; full rescan only on first miss or user Refresh.
  useEffect(() => {
    if (perspective !== "large-files") return;
    let cancelled = false;
    void (async () => {
      try {
        const inventoryRoots = await window.entropy.fs.getInventoryRoots(
          workspace.settings.inventoryExtraRoots,
        );
        const paths = inventoryRoots.map((root) => root.path);
        const key = largeFilesCacheKey(paths);
        const cached = getLargeFilesCache();
        if (cached?.key === key) {
          if (!cancelled) {
            setLargeFileEntries(cached.entries);
            setLargeFilesLoading(false);
            setError(null);
          }
          return;
        }

        if (!cancelled) {
          setLargeFilesLoading(true);
          setError(null);
        }
        const scan = await window.entropy.fs.scanLargeFiles(paths, LARGE_FILE_BYTES);
        if (cancelled) return;
        const nextEntries = toLargeFileEntries(scan);
        setLargeFilesCache({ key, result: scan, entries: nextEntries });
        setLargeFileEntries(nextEntries);
        if (scan.totalBytes !== workspace.settings.largeFilesApproxBytes) {
          updateSettings({ largeFilesApproxBytes: scan.totalBytes });
        }
      } catch (err) {
        if (!cancelled) {
          setLargeFileEntries([]);
          setError(err instanceof Error ? err.message : "Failed to scan large files");
        }
      } finally {
        if (!cancelled) setLargeFilesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    perspective,
    workspace.settings.inventoryExtraRoots,
    updateSettings,
    largeFilesScanId,
  ]);

  function refreshLargeFiles(): void {
    invalidateLargeFilesCache();
    setLargeFileEntries([]);
    setLargeFilesLoading(true);
    setError(null);
    setLargeFilesScanId((value) => value + 1);
  }

  // Storage map: show last scan for this folder; rescan only on miss or user Refresh.
  useEffect(() => {
    if (perspective !== "folders" || treemapCollapsed || !workspace.currentFolder) {
      setTreemapScanning(false);
      return;
    }
    let cancelled = false;
    const folder = workspace.currentFolder;
    const key = treemapCacheKey(folder);
    const cached = getTreemapCache();
    if (cached?.folderKey === key) {
      setTreemapScan(cached.scan);
      setTreemapScanning(false);
      return;
    }

    setTreemapScan(null);
    setTreemapScanning(true);
    void (async () => {
      try {
        const scan = await window.entropy.fs.scanTreemapLevel(folder);
        if (cancelled) return;
        setTreemapCache({ folderKey: key, scan });
        setTreemapScan(scan);
      } catch {
        if (!cancelled) setTreemapScan(null);
      } finally {
        if (!cancelled) setTreemapScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [perspective, treemapCollapsed, workspace.currentFolder, treemapScanId]);

  function refreshTreemap(): void {
    invalidateTreemapCache();
    setTreemapScan(null);
    setTreemapScanning(true);
    setTreemapScanId((value) => value + 1);
  }

  useEffect(() => {
    if (!isSearching) {
      setRemoteSearchEntries([]);
      setSearchHitMeta(new Map());
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const inventoryRoot = scanRoot || workspace.currentFolder;
          const marked = await window.entropy.workspace.listMarked().catch(() => []);
          const workspaceRoots = new Map<string, string>();
          workspaceRoots.set(workspace.path, workspace.name);
          for (const item of marked) {
            if (!workspaceRoots.has(item.path)) {
              workspaceRoots.set(item.path, item.name);
            }
          }

          const noteSearches = [...workspaceRoots.entries()].map(async ([root, name]) => {
            const notes = await window.entropy.fs.searchMarkdown(root, trimmedSearch).catch(() => []);
            return notes.map(
              (note): GlobalSearchHit => ({
                path: note.path,
                name: note.name,
                excerpt: note.excerpt,
                source: "note",
                workspacePath: root,
                workspaceName: name,
              }),
            );
          });

          const [noteLists, inventoryHits] = await Promise.all([
            Promise.all(noteSearches),
            inventoryRoot
              ? window.entropy.fs.searchInventoryNames(inventoryRoot, trimmedSearch)
              : Promise.resolve([] as GlobalSearchHit[]),
          ]);
          if (cancelled) return;

          const hits: GlobalSearchHit[] = [];
          const seen = new Set<string>();
          for (const list of noteLists) {
            for (const hit of list) {
              const key = hit.path.replace(/\\/g, "/").toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);
              hits.push(hit);
            }
          }
          for (const hit of inventoryHits) {
            const key = hit.path.replace(/\\/g, "/").toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            hits.push(hit);
          }

          const meta = new Map<string, GlobalSearchHit>();
          const resolved: FileEntry[] = [];
          await Promise.all(
            hits.map(async (hit) => {
              const key = hit.path.replace(/\\/g, "/").toLowerCase();
              meta.set(key, hit);
              try {
                resolved.push(await window.entropy.fs.stat(hit.path));
              } catch {
                resolved.push(hitToFileEntry(hit));
              }
            }),
          );
          if (cancelled) return;
          setSearchHitMeta(meta);
          setRemoteSearchEntries(resolved);
        } catch {
          if (!cancelled) {
            setRemoteSearchEntries([]);
            setSearchHitMeta(new Map());
          }
        } finally {
          if (!cancelled) setSearchLoading(false);
        }
      })();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    isSearching,
    trimmedSearch,
    scanRoot,
    workspace.currentFolder,
    workspace.path,
    workspace.name,
  ]);

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
    const sorted = [...sizedEntries].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sortKey === "modified") cmp = a.modifiedAt - b.modifiedAt;
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "type") cmp = a.extension.localeCompare(b.extension);
      return sortAsc ? cmp : -cmp;
    });
    if (!isSearching) return sorted;
    const q = trimmedSearch.toLowerCase();
    return sorted.filter((entry) => entry.name.toLowerCase().includes(q));
  }, [sizedEntries, sortAsc, sortKey, isSearching, trimmedSearch]);

  const largeFileVisible = useMemo(() => {
    return [...largeFileEntries].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sortKey === "modified") cmp = a.modifiedAt - b.modifiedAt;
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "type") cmp = a.extension.localeCompare(b.extension);
      return sortAsc ? cmp : -cmp;
    });
  }, [largeFileEntries, sortAsc, sortKey]);

  const galleryVisible = useMemo(() => {
    // Home-style content view: folders (with collage faces) + media, not media-only.
    const folders = folderVisible.filter((entry) => entry.isDirectory);
    const media = folderVisible.filter((entry) => isMediaEntry(entry) || isPreviewableEntry(entry));
    const source = [...folders, ...media];
    return source.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sortKey === "modified") cmp = a.modifiedAt - b.modifiedAt;
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "type") cmp = a.extension.localeCompare(b.extension);
      return sortAsc ? cmp : -cmp;
    });
  }, [folderVisible, sortAsc, sortKey]);

  const searchVisible = useMemo(() => {
    const byPath = new Map<string, FileEntry>();
    for (const entry of folderVisible) {
      byPath.set(entry.path.replace(/\\/g, "/").toLowerCase(), entry);
    }
    for (const entry of remoteSearchEntries) {
      const key = entry.path.replace(/\\/g, "/").toLowerCase();
      if (!byPath.has(key)) byPath.set(key, entry);
    }
    const merged = [...byPath.values()];
    return merged.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sortKey === "modified") cmp = a.modifiedAt - b.modifiedAt;
      if (sortKey === "size") cmp = a.size - b.size;
      if (sortKey === "type") cmp = a.extension.localeCompare(b.extension);
      return sortAsc ? cmp : -cmp;
    });
  }, [folderVisible, remoteSearchEntries, sortAsc, sortKey]);

  const tableEntries =
    isSearching
      ? searchVisible
      : perspective === "large-files"
        ? largeFileVisible
        : folderVisible;

  const listLoading =
    perspective === "large-files"
      ? largeFilesLoading
      : isSearching
        ? loading && folderVisible.length === 0
        : loading;

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
    if (isSearching) {
      const hit = searchHitMeta.get(entry.path.replace(/\\/g, "/").toLowerCase());
      if (hit?.source === "note") {
        const targetWorkspace = hit.workspacePath ?? workspace.path;
        if (!samePath(targetWorkspace, workspace.path)) {
          openInWorkspace(targetWorkspace, hit.path);
        } else {
          openNote(hit.path);
        }
        return;
      }
      if (entry.isDirectory || hit?.source === "folder") {
        openFolder(entry.path);
        return;
      }
      setSelected(entry);
      void openFileLocation(entry.path);
      return;
    }

    if (entry.isDirectory) {
      setSelected(null);
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
        setLargeFileEntries((prev) => prev.filter((item) => !samePath(item.path, targetPath)));
        setRemoteSearchEntries((prev) => prev.filter((item) => !samePath(item.path, targetPath)));
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
        referenceLabel: "Reference",
        onRename: () => void handleRename(entry),
        onReference: () => {
          void (async () => {
            const markdown = fileReferenceClipboardMarkdown(
              entry.path,
              entry.extension,
              entry.name,
            );
            try {
              await navigator.clipboard.writeText(markdown);
              setError(null);
            } catch {
              setError("Could not copy reference to the clipboard.");
            }
          })();
        },
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

  function toggleTreemap(): void {
    updateSettings({ inventoryTreemapCollapsed: !treemapCollapsed });
  }

  async function selectTreemapLeaf(leaf: TreemapFileLeaf): Promise<void> {
    if (leaf.isDirectory) {
      setSelected(null);
      return;
    }
    try {
      setSelected(await window.entropy.fs.stat(leaf.path));
    } catch {
      setSelected({
        name: leaf.name,
        path: leaf.path,
        isDirectory: false,
        size: leaf.size,
        modifiedAt: leaf.modifiedAt ?? 0,
        extension: leaf.extension,
      });
    }
  }

  const sortLabel =
    sortKey === "name"
      ? "Name"
      : sortKey === "modified"
        ? "Modified"
        : sortKey === "size"
          ? "Size"
          : "Type";

  const showTreemapToggle = perspective === "folders";
  const showTreemap = showTreemapToggle && !treemapCollapsed;

  const sortControl = (
    <div className="flex items-center gap-1.5">
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
      {perspective === "large-files" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Refresh large files"
              disabled={largeFilesLoading}
              onClick={refreshLargeFiles}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  largeFilesLoading && "animate-spin motion-reduce:animate-none",
                )}
                strokeWidth={1.75}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh large files</TooltipContent>
        </Tooltip>
      ) : null}
      {showTreemapToggle ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 text-muted-foreground",
                showTreemap && "text-foreground",
              )}
              aria-label={treemapCollapsed ? "Show storage map" : "Hide storage map"}
              aria-pressed={showTreemap}
              onClick={toggleTreemap}
            >
              <TreemapIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{treemapCollapsed ? "Show storage map" : "Hide storage map"}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );

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

            {listLoading || (isSearching && searchLoading && rows.length === 0) ? (
              <div className="flex flex-col gap-0 px-6 py-2" aria-busy="true" aria-label="Loading">
                {Array.from({ length: perspective === "large-files" ? 12 : 8 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 border-b py-2.5"
                    style={{ borderColor: figma.border }}
                  >
                    <Skeleton className="h-4 w-[220px] shrink-0 rounded-sm" />
                    <Skeleton className="h-4 min-w-0 flex-1 rounded-sm" />
                    <Skeleton className="h-4 w-16 shrink-0 rounded-sm" />
                    <Skeleton className="h-4 w-[120px] shrink-0 rounded-sm" />
                  </div>
                ))}
              </div>
            ) : null}

            {!listLoading && !(isSearching && searchLoading && rows.length === 0) && rows.length === 0 ? (
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
                    <ItemContextMenu
                      key={entry.path}
                      label={entry.name}
                      actions={fileActions(entry)}
                    >
                      <div
                        draggable
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "relative flex cursor-pointer items-center gap-4 border-b px-6 py-2 text-[13px]",
                          entry.isDirectory && dragOverPath === entry.path && "opacity-70",
                        )}
                        style={{
                          borderColor: figma.border,
                          backgroundColor: selectedRow ? figma.select : "transparent",
                          color: figma.ink,
                        }}
                        onClick={() => {
                          if (isSearching) {
                            void openEntry(entry);
                            return;
                          }
                          if (entry.isDirectory) setSelected(null);
                          else setSelected(entry);
                        }}
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
                          className="min-w-0 flex-1 truncate text-[12px] tracking-tight"
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
                      </div>
                    </ItemContextMenu>
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
        <InventoryBreadcrumb end={sortControl} />
        <ScrollArea className="min-h-0 flex-1" type="hover">
          <div className="px-6 py-4 pb-6">
            {error ? <p className="mb-3 text-sm text-muted-foreground">{error}</p> : null}

            {listLoading ? (
              <div className="entropy-gallery">
                <div className="entropy-gallery-grid">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-[4/5] w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ) : null}

            {!listLoading && galleryVisible.length === 0 ? (
              <Empty className="py-16">
                <EmptyTitle>Nothing to preview</EmptyTitle>
                <EmptyDescription>
                  Folders and media in this location will show here with previews.
                </EmptyDescription>
              </Empty>
            ) : null}

            {!listLoading && galleryVisible.length > 0 ? (
              <div className="entropy-gallery">
                <div className="entropy-gallery-grid">
                  {rendered.map((entry) => (
                    <FileGridCard
                      key={entry.path}
                      entry={entry}
                      homePath={homePath}
                      selected={selected?.path === entry.path}
                      dropTarget={false}
                      sizePending={false}
                      onSelect={() => {
                        if (!entry.isDirectory) setSelected(entry);
                        else setSelected(null);
                      }}
                      onOpen={() => void openEntry(entry)}
                      onDragStart={(event) => onDragStart(event, entry)}
                      actions={fileActions(entry)}
                    />
                  ))}
                  {rendered.length < galleryVisible.length ? (
                    <div ref={loadMoreRef} className="col-span-full h-8 w-full" aria-hidden />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </>
    );
  }

  function renderMain() {
    if (!isSearching && perspective === "gallery") return renderGallery();

    if (!isSearching && perspective === "large-files") {
      return (
        <>
          <InventoryBreadcrumb end={sortControl} />
          {renderFileTable(
            tableEntries,
            "No large files found",
            "Files over 100 MB under Home and your added Library roots will show up here.",
          )}
        </>
      );
    }

    return (
      <>
        <InventoryBreadcrumb end={sortControl} />
        {renderFileTable(
          tableEntries,
          isSearching ? "No matches" : "Nothing here yet",
          isSearching
            ? "Try a different name, or clear the search."
            : "Drop files into this folder, or pick another path above.",
        )}
      </>
    );
  }

  const showChrome = perspective !== "duplicates";

  return (
    <div className="flex h-full min-h-0 w-full flex-col" aria-label="Library">
      <div className="min-h-0 flex-1">
        {perspective === "duplicates" ? (
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
              selected && !selected.isDirectory ? (
                <FileIntelligencePanel
                  entry={selected}
                  scanRoot={scanRoot}
                  onClose={() => setSelected(null)}
                />
              ) : showTreemap ? (
                <StorageTreemap
                  scan={treemapScan}
                  scanning={treemapScanning}
                  selectedPath={selected?.path ?? null}
                  onRefresh={refreshTreemap}
                  onSelect={(leaf) => void selectTreemapLeaf(leaf)}
                  onOpen={(leaf) => {
                    if (leaf.isDirectory) goToFolder(leaf.path);
                  }}
                  onZoom={(leaf) => {
                    if (leaf.isDirectory) goToFolder(leaf.path);
                  }}
                />
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
      <ItemContextMenu label={entry.name} actions={actions}>
        <div
          draggable
          className={cn(
            "min-w-0 cursor-pointer rounded-lg border p-2",
            dropTarget && "opacity-70",
          )}
          style={{
            backgroundColor: figma.canvas,
            borderColor: selected ? figma.accent : figma.border,
            outline: "none",
          }}
          onClick={onSelect}
          onDoubleClick={onOpen}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <div
            className="mb-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-[4px]"
            style={{ backgroundColor: figma.surface }}
          >
            {face === "icon" ? (
              entry.isDirectory ? (
                <Folder className="size-9" style={{ color: figma.muted }} strokeWidth={1.15} />
              ) : mediaKind(entry.extension) === "image" ? (
                <Image className="size-9" style={{ color: figma.muted }} strokeWidth={1.15} />
              ) : (
                <FileText className="size-9" style={{ color: figma.muted }} strokeWidth={1.15} />
              )
            ) : face === "preview" ? (
              <EntryPreview
                entry={entry}
                size="lg"
                className="aspect-auto h-full w-full rounded-[4px]"
              />
            ) : null}
          </div>

          <div className="min-w-0">
            <p
              className="truncate text-[12px] font-medium"
              style={{ color: figma.ink }}
              title={entry.name}
            >
              {entry.name}
            </p>
            <p
              className="mt-0.5 truncate text-[11px]"
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
        </div>
      </ItemContextMenu>
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
