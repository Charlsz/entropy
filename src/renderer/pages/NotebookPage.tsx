import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronDown, ChevronRight, FilePlus2, Folder } from "lucide-react";
import type { FileEntry, RecentWorkspace } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { MarkdownEditor, type MarkdownEditorHandle } from "../pages/MarkdownEditor";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { ItemContextMenu } from "../components/ItemContextMenu";
import type { ItemAction } from "../components/ItemActionsMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MoveToDialog } from "../components/MoveToDialog";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { ThreeColumnLayout } from "../components/ThreeColumnLayout";
import { NoteContextPanel } from "../components/NoteContextPanel";
import { copyPath, moveEntryToFolder, revealPath } from "../lib/itemActions";
import { noteContextIsUseful } from "../lib/noteContext";
import {
  buildNoteFolderTree,
  noteAncestorFolders,
  parentDirOfNote,
  type NoteTreeFolder,
  type NoteTreeNote,
} from "../lib/noteFolderTree";
import { useDirWatch } from "../hooks/useDirWatch";
import { isLiveEmbedExt, linkMarkdown, mediaEmbedMarkdown } from "../lib/markdownBlocks";
import { formatBytes, formatModifiedLabel } from "../lib/format";
import { figma } from "../lib/figmaTokens";
import { osTrashName, samePath } from "../lib/platform";
import { revealInFolderLabel } from "../../shared/platform";
import { useAppToasts } from "../components/ToastProvider";
import { cn } from "../lib/utils";

export function NotebookPage({
  pendingNote,
  onPendingNoteHandled,
  pendingReference,
  onPendingReferenceHandled,
  onPickWorkspace,
}: {
  pendingNote?: string | null;
  onPendingNoteHandled?: () => void;
  pendingReference?: string | null;
  onPendingReferenceHandled?: () => void;
  onPickWorkspace?: (path: string) => void;
} = {}) {
  const { workspace, addRecentFile, visitNote, openFolder, updateSettings } = useWorkspace();
  const [notes, setNotes] = useState<FileEntry[]>([]);
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  /** Folder that receives New Note (workspace root or a nested notes folder). */
  const [createFolderPath, setCreateFolderPath] = useState(workspace.path);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setStatusRight] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const [contextUseful, setContextUseful] = useState(false);
  const [contextEpoch, setContextEpoch] = useState(0);
  const [diskEpoch, setDiskEpoch] = useState(0);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const activePathRef = useRef<string | null>(null);
  const insertedReferenceKeysRef = useRef(new Set<string>());
  const [queuedReference, setQueuedReference] = useState<string | null>(null);
  const [liveContent, setLiveContent] = useState<string | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const { pushToast } = useAppToasts();
  const refreshNotesRef = useRef<(options?: { quiet?: boolean }) => Promise<void>>(async () => undefined);
  const openNoteRef = useRef<(path: string) => void>(() => undefined);
  activePathRef.current = activePath;

  useEffect(() => {
    let cancelled = false;
    void window.entropy.workspace.getRecent().then((items) => {
      if (!cancelled) setRecentWorkspaces(items);
    });
    return () => {
      cancelled = true;
    };
  }, [workspace.path]);

  useEffect(() => {
    setCreateFolderPath(workspace.path);
    setExpandedFolders(new Set());
  }, [workspace.path]);

  const refreshNotes = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = Boolean(options?.quiet);
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      setNotes(await window.entropy.fs.listMarkdown(workspace.path));
      if (quiet) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [workspace.path]);

  refreshNotesRef.current = refreshNotes;

  useEffect(() => {
    if (workspace.currentSection !== "notebook") return;
    void refreshNotes();
  }, [refreshNotes, workspace.currentSection]);

  useDirWatch(
    workspace.path,
    () => {
      void refreshNotes({ quiet: true });
      setContextEpoch((value) => value + 1);
      setDiskEpoch((value) => value + 1);
    },
    {
      // Stay live even while Inventory is focused (sections keep-alive).
      recursive: true,
      enabled: Boolean(workspace.path),
    },
  );

  // Slow safety net if directory watch drops events (Obsidian/Windows).
  useEffect(() => {
    if (!workspace.path) return;
    const timer = window.setInterval(() => {
      void refreshNotes({ quiet: true });
      setDiskEpoch((value) => value + 1);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [workspace.path, refreshNotes]);

  useEffect(() => {
    if (!pendingNote) return;
    setOpenPaths((prev) => (prev.includes(pendingNote) ? prev : [...prev, pendingNote]));
    setActivePath(pendingNote);
    onPendingNoteHandled?.();
  }, [pendingNote, onPendingNoteHandled]);

  const buildReferenceMarkdown = useCallback(async (notePath: string, entry: FileEntry) => {
    const noteDir = await window.entropy.fs.dirname(notePath);
    const relative = await window.entropy.fs.relative(noteDir, entry.path);
    const hrefSource =
      /[:/\\]/.test(relative) && relative.includes(":")
        ? entry.path
        : relative || entry.path;
    const href = hrefSource.replace(/\\/g, "/");
    const label = entry.isDirectory ? entry.name : entry.name.replace(/\.md$/i, "");
    return isLiveEmbedExt(entry.extension)
      ? mediaEmbedMarkdown(href, label)
      : linkMarkdown(label, href);
  }, []);

  const insertReferenceIntoOpenNote = useCallback(
    async (notePath: string, entry: FileEntry, signal: { cancelled: boolean }) => {
      if (entry.path === notePath) {
        setError("Pick another note or file to reference.");
        setPreviewEntry(entry);
        return false;
      }

      setOpenPaths((prev) => (prev.includes(notePath) ? prev : [...prev, notePath]));
      setActivePath(notePath);

      const insert = await buildReferenceMarkdown(notePath, entry);
      const deadline = Date.now() + 4000;
      while (!signal.cancelled && Date.now() < deadline) {
        if (editorRef.current?.insertMarkdown(insert)) {
          setPreviewEntry(entry);
          setContextEpoch((value) => value + 1);
          setError(null);
          return true;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      return false;
    },
    [buildReferenceMarkdown],
  );

  /** Prefer the open note, then last Notebook note, then last recent .md that still exists. */
  const resolveTargetNote = useCallback(async (): Promise<string | null> => {
    const candidates = [
      activePathRef.current,
      workspace.activeNotePath,
      ...workspace.recentFiles,
    ].filter((path): path is string => Boolean(path));

    const seen = new Set<string>();
    for (const candidate of candidates) {
      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!/\.md$/i.test(candidate)) continue;
      try {
        if (!(await window.entropy.fs.exists(candidate))) continue;
        const stat = await window.entropy.fs.stat(candidate);
        if (!stat.isDirectory) return candidate;
      } catch {
        // Missing or unreadable — try the next candidate.
      }
    }
    return null;
  }, [workspace.activeNotePath, workspace.recentFiles]);

  useEffect(() => {
    if (!pendingReference) return;
    const signal = { cancelled: false };

    void (async () => {
      try {
        const entry = await window.entropy.fs.stat(pendingReference);
        if (signal.cancelled) return;

        // Always surface the file in the Notebook context panel.
        setPreviewEntry(entry);
        setError(null);

        let notePath = await resolveTargetNote();
        if (signal.cancelled) return;

        if (!notePath) {
          const existing = await window.entropy.fs.listMarkdown(workspace.path);
          if (signal.cancelled) return;

          if (existing.length === 0) {
            // Only create a note when the workspace has no Markdown at all.
            notePath = await window.entropy.fs.createNote(workspace.path);
            if (signal.cancelled) return;
            void refreshNotes({ quiet: true });
          } else {
            // Notes exist but none is "current" — panel only until the user opens one.
            setQueuedReference(entry.path);
            onPendingReferenceHandled?.();
            return;
          }
        }

        setQueuedReference(null);
        const inserted = await insertReferenceIntoOpenNote(notePath, entry, signal);
        if (signal.cancelled) return;
        if (!inserted) {
          setError("Could not add the file to the open note. Try again.");
          setQueuedReference(entry.path);
        }
        onPendingReferenceHandled?.();
      } catch (err) {
        if (!signal.cancelled) {
          setError(err instanceof Error ? err.message : "Failed to reference file");
          onPendingReferenceHandled?.();
        }
      }
    })();

    return () => {
      signal.cancelled = true;
    };
  }, [
    pendingReference,
    onPendingReferenceHandled,
    resolveTargetNote,
    insertReferenceIntoOpenNote,
    refreshNotes,
    workspace.path,
  ]);

  // Deferred insert: user opened a note after Add to Workspace showed panel-only.
  useEffect(() => {
    if (!queuedReference || !activePath) return;
    const filePath = queuedReference;
    const notePath = activePath;
    const key = `${filePath}\0${notePath}`;
    if (insertedReferenceKeysRef.current.has(key)) {
      setQueuedReference(null);
      return;
    }

    // Claim before await so Strict Mode cannot insert the same pair twice.
    insertedReferenceKeysRef.current.add(key);
    setQueuedReference(null);
    setContextEpoch((value) => value + 1);

    let cancelled = false;
    void (async () => {
      try {
        const entry = await window.entropy.fs.stat(filePath);
        if (cancelled) return;
        const inserted = await insertReferenceIntoOpenNote(notePath, entry, {
          cancelled: false,
        });
        if (cancelled) return;
        if (!inserted) {
          insertedReferenceKeysRef.current.delete(key);
          setQueuedReference(filePath);
        }
      } catch {
        insertedReferenceKeysRef.current.delete(key);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queuedReference, activePath, insertReferenceIntoOpenNote]);

  function openNoteLocal(notePath: string): void {
    setOpenPaths((prev) => (prev.includes(notePath) ? prev : [...prev, notePath]));
    setActivePath(notePath);
    setCreateFolderPath(parentDirOfNote(notePath, workspace.path));
    addRecentFile(notePath);
  }

  function openNote(notePath: string): void {
    openNoteLocal(notePath);
    visitNote(notePath);
  }
  openNoteRef.current = openNote;

  function toggleFolder(folderPath: string): void {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  }

  function selectFolder(folderPath: string): void {
    setCreateFolderPath(folderPath);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.add(folderPath);
      return next;
    });
  }

  // Keep the active note’s folder chain expanded so nested files stay reachable.
  useEffect(() => {
    if (!activePath) return;
    const ancestors = noteAncestorFolders(workspace.path, activePath);
    if (ancestors.length === 0) return;
    setExpandedFolders((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const folder of ancestors) {
        if (!next.has(folder)) {
          next.add(folder);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activePath, workspace.path]);

  function closeTab(notePath: string): void {
    setOpenPaths((prev) => {
      const next = prev.filter((path) => path !== notePath);
      if (activePath === notePath) setActivePath(next[next.length - 1] ?? null);
      return next;
    });
  }

  async function handleCreate(): Promise<void> {
    try {
      const targetDir = createFolderPath || workspace.path;
      const created = await window.entropy.fs.createNote(targetDir);
      openNote(created);
      await refreshNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    }
  }

  function requestDelete(notePath: string): void {
    setPendingDelete(notePath);
  }

  async function confirmDelete(): Promise<void> {
    const notePath = pendingDelete;
    if (!notePath) return;
    setPendingDelete(null);
    try {
      const info = await window.entropy.fs.stat(notePath).catch(() => null);
      // Close the tab before remove so disk-sync never readText's a gone path.
      flushSync(() => {
        closeTab(notePath);
      });
      await window.entropy.fs.remove(notePath);
      const paths = [notePath];
      const trash = osTrashName();
      const size = info?.size ?? 0;
      pushToast({
        title: `Moved to ${trash}`,
        detail: size > 0 ? formatBytes(size) : undefined,
        actionLabel: "Undo",
        showOpenTrash: true,
        onAction: async () => {
          const result = await window.entropy.fs.undoRemove(paths);
          if (result.restored === 0) {
            throw new Error(`Couldn't restore the note. It may already be gone from ${trash}.`);
          }
          await refreshNotesRef.current({ quiet: true });
          const restored = paths[0];
          if (restored) openNoteRef.current(restored);
        },
        onDismiss: () => {
          void window.entropy.fs.finalizeTrash(paths).catch(() => undefined);
        },
      });
      setError(null);
      await refreshNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
      await refreshNotes();
    }
  }

  function startRename(note: FileEntry): void {
    setRenaming(note.path);
    setRenameValue(
      note.isDirectory || note.extension.toLowerCase() === ".md"
        ? note.name.replace(/\.md$/i, "")
        : note.name,
    );
  }

  async function commitRename(notePath: string): Promise<void> {
    const entry = notes.find((item) => item.path === notePath) ?? previewEntry;
    const isMarkdown = (entry?.extension ?? ".md").toLowerCase() === ".md" && !entry?.isDirectory;
    const nextName = isMarkdown
      ? renameValue.trim().replace(/\.md$/i, "")
      : renameValue.trim();
    setRenaming(null);
    if (!nextName) return;
    try {
      const dir = await window.entropy.fs.dirname(notePath);
      const target = await window.entropy.fs.join(
        dir,
        isMarkdown ? `${nextName}.md` : nextName,
      );
      if (target === notePath) return;
      if (await window.entropy.fs.exists(target)) {
        setError("An item with that name already exists.");
        return;
      }
      await window.entropy.fs.rename(notePath, target);
      setOpenPaths((prev) => prev.map((path) => (path === notePath ? target : path)));
      if (activePath === notePath) setActivePath(target);
      if (previewEntry?.path === notePath) {
        setPreviewEntry(await window.entropy.fs.stat(target));
      }
      await refreshNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
    }
  }

  async function referenceEntry(entry: FileEntry): Promise<void> {
    if (!activePath) {
      setError("Open a note before referencing a file.");
      setPreviewEntry(entry);
      return;
    }
    if (entry.path === activePath) {
      setError("Pick another note or file to reference.");
      return;
    }

    try {
      const noteDir = await window.entropy.fs.dirname(activePath);
      const relative = await window.entropy.fs.relative(noteDir, entry.path);
      const label = entry.isDirectory ? entry.name : entry.name.replace(/\.md$/i, "");
      const href = relative.replace(/\\/g, "/");
      const insert = isLiveEmbedExt(entry.extension)
        ? mediaEmbedMarkdown(href, label)
        : linkMarkdown(label, href);
      editorRef.current?.insertMarkdown(insert);
      setPreviewEntry(entry);
      setContextEpoch((value) => value + 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reference file");
    }
  }

  async function handleMove(destinationFolder: string): Promise<void> {
    const source = movingPath;
    setMovingPath(null);
    if (!source) return;
    try {
      const target = await moveEntryToFolder(source, destinationFolder);
      setOpenPaths((prev) => prev.map((path) => (path === source ? target : path)));
      if (activePath === source) setActivePath(target);
      if (previewEntry?.path === source) {
        setPreviewEntry(await window.entropy.fs.stat(target));
      }
      await refreshNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move item");
    }
  }

  function noteActions(note: { path: string; name: string }): ItemAction[] {
    const osRevealLabel = revealInFolderLabel(window.entropy.platform).replace(/^Show in\s+/i, "");
    return [
      {
        label: "Rename",
        onSelect: () =>
          startRename({
            name: note.name,
            path: note.path,
            isDirectory: false,
            size: 0,
            modifiedAt: 0,
            extension: ".md",
          }),
      },
      { label: "Copy path", onSelect: () => void copyPath(note.path) },
      {
        label: "Show in",
        children: [
          {
            label: "Folders",
            onSelect: () => {
              void (async () => {
                const dir = await window.entropy.fs.dirname(note.path);
                updateSettings({ libraryPerspective: "folders", intelligenceView: null });
                openFolder(dir);
              })();
            },
          },
          {
            label: "Gallery",
            onSelect: () => {
              void (async () => {
                const dir = await window.entropy.fs.dirname(note.path);
                updateSettings({ libraryPerspective: "gallery", intelligenceView: null });
                openFolder(dir);
              })();
            },
          },
          {
            label: osRevealLabel,
            onSelect: () => void revealPath(note.path),
          },
        ],
      },
      { label: "Move to…", onSelect: () => setMovingPath(note.path) },
      { label: "Delete", destructive: true, onSelect: () => requestDelete(note.path) },
    ];
  }

  const noteTree = useMemo(
    () => buildNoteFolderTree(notes, workspace.path),
    [notes, workspace.path],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const useful = await noteContextIsUseful(
        activePath,
        previewEntry,
        workspace.path,
        liveContent,
      );
      if (!cancelled) setContextUseful(useful);
    })();
    return () => {
      cancelled = true;
    };
  }, [activePath, previewEntry, workspace.path, contextEpoch, liveContent]);

  const context =
    contextUseful || previewEntry ? (
      <NoteContextPanel
        notePath={activePath}
        previewEntry={previewEntry}
        liveContent={liveContent}
        onOpenNote={openNote}
        onReference={(entry) => void referenceEntry(entry)}
        onClearPreview={() => setPreviewEntry(null)}
        onRewriteHref={(from, to) => {
          editorRef.current?.rewriteHref(from, to);
          setContextEpoch((value) => value + 1);
        }}
      />
    ) : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <ThreeColumnLayout
        id="notebook-layout"
        persistLayout={workspace.currentSection === "notebook"}
        context={context}
        sidebar={
          <div
            className="flex h-full min-h-0 w-full flex-col"
            style={{ backgroundColor: figma.surface, borderRight: `1px solid ${figma.border}` }}
          >
            <div className="flex items-center gap-1.5 px-4 py-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-left outline-none hover:bg-select focus-visible:bg-select"
                    aria-label="Switch workspace"
                    onClick={() => setCreateFolderPath(workspace.path)}
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-[13px] font-semibold"
                      style={{ color: figma.ink }}
                      title={workspace.name}
                    >
                      {workspace.name}
                    </span>
                    <ChevronDown
                      className="size-3.5 shrink-0"
                      style={{ color: figma.muted }}
                      strokeWidth={1.75}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[12rem]">
                  {recentWorkspaces.map((item) => {
                    const active = samePath(item.path, workspace.path);
                    return (
                      <DropdownMenuItem
                        key={item.path}
                        disabled={active || !onPickWorkspace}
                        onSelect={() => onPickWorkspace?.(item.path)}
                      >
                        <span className="truncate">{item.name}</span>
                      </DropdownMenuItem>
                    );
                  })}
                  {recentWorkspaces.length > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem
                    disabled={!onPickWorkspace}
                    onSelect={() => {
                      void (async () => {
                        const selected = await window.entropy.workspace.open();
                        if (selected) onPickWorkspace?.(selected);
                      })();
                    }}
                  >
                    Open workspace…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    aria-label="New note"
                    onClick={() => void handleCreate()}
                  >
                    <FilePlus2 className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {samePath(createFolderPath, workspace.path)
                    ? "New note"
                    : `New note in ${createFolderPath.split(/[/\\]/).pop() || "folder"}`}
                </TooltipContent>
              </Tooltip>
            </div>

            <ScrollArea className="min-h-0 flex-1" type="hover">
              <div className="pb-6">
                {error ? <p className="px-4 pb-2 text-sm text-muted-foreground">{error}</p> : null}
                {loading ? (
                  <div className="space-y-1 px-4">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : null}
                {!loading && notes.length === 0 ? (
                  <Empty className="py-16">
                    <EmptyTitle>No notes yet</EmptyTitle>
                    <EmptyDescription>Use + to create a note and start writing.</EmptyDescription>
                  </Empty>
                ) : null}

                <ul aria-label="Notes">
                  {!loading
                    ? noteTree.map((node) =>
                        node.type === "folder" ? (
                          <NoteFolderRow
                            key={node.path}
                            folder={node}
                            depth={0}
                            expandedFolders={expandedFolders}
                            createFolderPath={createFolderPath}
                            activePath={activePath}
                            renaming={renaming}
                            renameValue={renameValue}
                            onRenameValueChange={setRenameValue}
                            onToggleFolder={toggleFolder}
                            onSelectFolder={selectFolder}
                            onOpenNote={openNote}
                            onStartRename={startRename}
                            onCommitRename={(path) => void commitRename(path)}
                            onCancelRename={() => setRenaming(null)}
                            noteActions={noteActions}
                            dismissKey={workspace.currentSection}
                          />
                        ) : (
                          <NoteFileRow
                            key={node.path}
                            note={node}
                            depth={0}
                            activePath={activePath}
                            renaming={renaming}
                            renameValue={renameValue}
                            onRenameValueChange={setRenameValue}
                            onOpenNote={openNote}
                            onStartRename={startRename}
                            onCommitRename={(path) => void commitRename(path)}
                            onCancelRename={() => setRenaming(null)}
                            noteActions={noteActions}
                            dismissKey={workspace.currentSection}
                          />
                        ),
                      )
                    : null}
                </ul>
              </div>
            </ScrollArea>
          </div>
        }
        main={
          <MarkdownEditor
            ref={editorRef}
            openPaths={openPaths}
            activePath={activePath}
            diskEpoch={diskEpoch}
            onActiveChange={(notePath) => {
              openNoteLocal(notePath);
              visitNote(notePath);
            }}
            onCloseTab={closeTab}
            onNotePathChange={(fromPath, toPath) => {
              setOpenPaths((prev) => prev.map((path) => (path === fromPath ? toPath : path)));
              setActivePath((current) => (current === fromPath ? toPath : current));
              void refreshNotes({ quiet: true });
              visitNote(toPath);
            }}
            onStatsChange={setStatusRight}
            onLiveContentChange={setLiveContent}
            onOpenLocalPath={(absolutePath) => {
              void (async () => {
                try {
                  const info = await window.entropy.fs.stat(absolutePath);
                  if (info.extension.toLowerCase() === ".md") {
                    openNote(info.path);
                    return;
                  }
                  setPreviewEntry(info);
                } catch {
                  // Ignore missing targets.
                }
              })();
            }}
          />
        }
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? `Delete “${pendingDelete.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "note"}”?`
            : "Delete note?"
        }
        description={`Moves to ${osTrashName()}. Recover until emptied.`}
        confirmLabel="Move to trash"
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />
      <MoveToDialog
        open={movingPath !== null}
        rootPath={workspace.path}
        rootName={workspace.name}
        excludePath={movingPath ?? workspace.path}
        onClose={() => setMovingPath(null)}
        onMove={(folder) => void handleMove(folder)}
      />
    </div>
  );
}

function NoteFolderRow({
  folder,
  depth,
  expandedFolders,
  createFolderPath,
  activePath,
  renaming,
  renameValue,
  onRenameValueChange,
  onToggleFolder,
  onSelectFolder,
  onOpenNote,
  onStartRename,
  onCommitRename,
  onCancelRename,
  noteActions,
  dismissKey,
}: {
  folder: NoteTreeFolder;
  depth: number;
  expandedFolders: Set<string>;
  createFolderPath: string;
  activePath: string | null;
  renaming: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onToggleFolder: (path: string) => void;
  onSelectFolder: (path: string) => void;
  onOpenNote: (path: string) => void;
  onStartRename: (note: FileEntry) => void;
  onCommitRename: (path: string) => void;
  onCancelRename: () => void;
  noteActions: (note: { path: string; name: string }) => ItemAction[];
  dismissKey: string;
}) {
  const expanded = expandedFolders.has(folder.path);
  const selected = samePath(createFolderPath, folder.path);

  return (
    <li>
      <div
        className="flex min-w-0 items-center"
        style={{
          backgroundColor: selected ? figma.select : "transparent",
          borderBottom: `1px solid ${figma.border}`,
          paddingLeft: 8 + depth * 12,
        }}
      >
        <button
          type="button"
          className="flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={expanded ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
          aria-expanded={expanded}
          onClick={() => onToggleFolder(folder.path)}
        >
          {expanded ? (
            <ChevronDown className="size-3.5" strokeWidth={1.75} />
          ) : (
            <ChevronRight className="size-3.5" strokeWidth={1.75} />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 py-2 pr-4 text-left"
          onClick={() => onSelectFolder(folder.path)}
          title={folder.path}
        >
          <Folder className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />
          <span
            className={cn("truncate text-[13px]", selected ? "font-medium" : "font-normal")}
            style={{ color: figma.ink }}
          >
            {folder.name}
          </span>
        </button>
      </div>
      {expanded ? (
        <ul>
          {folder.children.map((child) =>
            child.type === "folder" ? (
              <NoteFolderRow
                key={child.path}
                folder={child}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                createFolderPath={createFolderPath}
                activePath={activePath}
                renaming={renaming}
                renameValue={renameValue}
                onRenameValueChange={onRenameValueChange}
                onToggleFolder={onToggleFolder}
                onSelectFolder={onSelectFolder}
                onOpenNote={onOpenNote}
                onStartRename={onStartRename}
                onCommitRename={onCommitRename}
                onCancelRename={onCancelRename}
                noteActions={noteActions}
                dismissKey={dismissKey}
              />
            ) : (
              <NoteFileRow
                key={child.path}
                note={child}
                depth={depth + 1}
                activePath={activePath}
                renaming={renaming}
                renameValue={renameValue}
                onRenameValueChange={onRenameValueChange}
                onOpenNote={onOpenNote}
                onStartRename={onStartRename}
                onCommitRename={onCommitRename}
                onCancelRename={onCancelRename}
                noteActions={noteActions}
                dismissKey={dismissKey}
              />
            ),
          )}
        </ul>
      ) : null}
    </li>
  );
}

function NoteFileRow({
  note,
  depth,
  activePath,
  renaming,
  renameValue,
  onRenameValueChange,
  onOpenNote,
  onStartRename,
  onCommitRename,
  onCancelRename,
  noteActions,
  dismissKey,
}: {
  note: NoteTreeNote;
  depth: number;
  activePath: string | null;
  renaming: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onOpenNote: (path: string) => void;
  onStartRename: (note: FileEntry) => void;
  onCommitRename: (path: string) => void;
  onCancelRename: () => void;
  noteActions: (note: { path: string; name: string }) => ItemAction[];
  dismissKey: string;
}) {
  const title = note.name.replace(/\.md$/i, "");
  const active = activePath === note.path;
  const padLeft = 8 + depth * 12 + (depth > 0 ? 0 : 0);

  return (
    <li style={{ borderBottom: `1px solid ${figma.border}` }}>
      {renaming === note.path ? (
        <div className="px-4 py-2.5" style={{ paddingLeft: padLeft + 28 }}>
          <Input
            className="h-9"
            value={renameValue}
            autoFocus
            onChange={(event) => onRenameValueChange(event.target.value)}
            onBlur={() => onCommitRename(note.path)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCommitRename(note.path);
              if (event.key === "Escape") onCancelRename();
            }}
          />
        </div>
      ) : (
        <ItemContextMenu label={title} actions={noteActions(note)} dismissKey={dismissKey}>
          <div
            className="group flex min-w-0 items-start"
            style={{
              backgroundColor: active ? figma.select : "transparent",
              paddingLeft: padLeft,
            }}
          >
            <span className="size-7 shrink-0" aria-hidden />
            <button
              type="button"
              className="min-w-0 flex-1 py-2.5 pr-4 text-left"
              title={note.path}
              onClick={() => onOpenNote(note.path)}
              onDoubleClick={() =>
                onStartRename({
                  name: note.name,
                  path: note.path,
                  isDirectory: false,
                  size: 0,
                  modifiedAt: note.modifiedAt,
                  extension: ".md",
                })
              }
            >
              <p
                className={cn("truncate text-[13px]", active ? "font-medium" : "font-normal")}
                style={{ color: figma.ink }}
              >
                {title}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: figma.muted }}>
                {note.modifiedAt ? formatModifiedLabel(note.modifiedAt) : "Local note"}
              </p>
            </button>
          </div>
        </ItemContextMenu>
      )}
    </li>
  );
}

