import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FilePlus2 } from "lucide-react";
import type { FileEntry, NoteSearchResult } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { MarkdownEditor, type MarkdownEditorHandle } from "../pages/MarkdownEditor";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { ItemActionsMenu } from "../components/ItemActionsMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MoveToDialog } from "../components/MoveToDialog";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { ThreeColumnLayout } from "../components/ThreeColumnLayout";
import { NoteContextPanel } from "../components/NoteContextPanel";
import { buildEntryActions, copyPath, moveEntryToFolder, revealPath } from "../lib/itemActions";
import { noteContextIsUseful } from "../lib/noteContext";
import { useDirWatch } from "../hooks/useDirWatch";
import { isLiveEmbedExt, linkMarkdown, mediaEmbedMarkdown } from "../lib/markdownBlocks";
import { formatBytes, formatModifiedLabel } from "../lib/format";
import { figma } from "../lib/figmaTokens";
import { osTrashName } from "../lib/platform";
import { TrashUndoBar } from "../components/TrashUndoBar";
import { cn } from "../lib/utils";

export function NotebookPage({
  pendingNote,
  onPendingNoteHandled,
  pendingReference,
  onPendingReferenceHandled,
}: {
  pendingNote?: string | null;
  onPendingNoteHandled?: () => void;
  pendingReference?: string | null;
  onPendingReferenceHandled?: () => void;
} = {}) {
  const { workspace, addRecentFile, visitNote } = useWorkspace();
  const [notes, setNotes] = useState<FileEntry[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NoteSearchResult[] | null>(null);
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setStatusRight] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [undoTrash, setUndoTrash] = useState<{
    paths: string[];
    name: string;
    size: number;
  } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const [contextUseful, setContextUseful] = useState(false);
  const [contextEpoch, setContextEpoch] = useState(0);
  const [diskEpoch, setDiskEpoch] = useState(0);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const activePathRef = useRef<string | null>(null);
  const insertedReferenceKeysRef = useRef(new Set<string>());
  const [queuedReference, setQueuedReference] = useState<string | null>(null);
  const [liveContent, setLiveContent] = useState<string | null>(null);
  activePathRef.current = activePath;

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

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void window.entropy.fs
        .searchMarkdown(workspace.path, query)
        .then((results) => {
          if (!cancelled) setSearchResults(results);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, workspace.path]);

  function openNoteLocal(notePath: string): void {
    setOpenPaths((prev) => (prev.includes(notePath) ? prev : [...prev, notePath]));
    setActivePath(notePath);
    addRecentFile(notePath);
  }

  function openNote(notePath: string): void {
    openNoteLocal(notePath);
    visitNote(notePath);
  }

  function closeTab(notePath: string): void {
    setOpenPaths((prev) => {
      const next = prev.filter((path) => path !== notePath);
      if (activePath === notePath) setActivePath(next[next.length - 1] ?? null);
      return next;
    });
  }

  async function handleCreate(): Promise<void> {
    try {
      const created = await window.entropy.fs.createNote(workspace.path);
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
      if (undoTrash) {
        await window.entropy.fs.finalizeTrash(undoTrash.paths);
        setUndoTrash(null);
      }
      await window.entropy.fs.remove(notePath);
      setUndoTrash({
        paths: [notePath],
        name: notePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "Note",
        size: info?.size ?? 0,
      });
      setError(null);
      await refreshNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
      await refreshNotes();
    }
  }

  async function undoTrashAction(): Promise<void> {
    if (!undoTrash) return;
    setUndoBusy(true);
    try {
      const result = await window.entropy.fs.undoRemove(undoTrash.paths);
      if (result.restored > 0) {
        const restored = undoTrash.paths[0];
        setUndoTrash(null);
        await refreshNotes();
        if (restored) openNote(restored);
      } else {
        setError(`Couldn't restore the note. It may already be gone from ${osTrashName()}.`);
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

  function noteActions(note: { path: string; name: string }) {
    return buildEntryActions({
      canReference: true,
      onRename: () =>
        startRename({
          name: note.name,
          path: note.path,
          isDirectory: false,
          size: 0,
          modifiedAt: 0,
          extension: ".md",
        }),
      onReference: () =>
        void referenceEntry({
          name: note.name,
          path: note.path,
          isDirectory: false,
          size: 0,
          modifiedAt: 0,
          extension: ".md",
        }),
      onCopyPath: () => void copyPath(note.path),
      onReveal: () => void revealPath(note.path),
      onMoveTo: () => setMovingPath(note.path),
      onDelete: () => requestDelete(note.path),
    });
  }

  const visibleNotes = searchResults
    ? searchResults.map((result) => ({
        path: result.path,
        name: result.name,
        excerpt: result.excerpt,
        modifiedAt: notes.find((note) => note.path === result.path)?.modifiedAt ?? 0,
      }))
    : notes.map((note) => ({
        path: note.path,
        name: note.name,
        excerpt: "",
        modifiedAt: note.modifiedAt,
      }));

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
            <div className="flex items-center gap-2 p-4">
              <p
                className="min-w-0 flex-1 text-[11px] font-semibold uppercase"
                style={{ color: figma.muted }}
              >
                Local Notes ({notes.length})
              </p>
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
                <TooltipContent>New note</TooltipContent>
              </Tooltip>
            </div>
            <div className="px-4 pb-3">
              <Input
                type="search"
                placeholder="Filter notes…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Filter notes"
                className="h-8 border-border bg-background"
              />
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
                {!loading && visibleNotes.length === 0 ? (
                  <Empty className="py-16">
                    <EmptyTitle>No notes yet</EmptyTitle>
                    <EmptyDescription>Use + to create a note and start writing.</EmptyDescription>
                  </Empty>
                ) : null}

                <ul aria-label="Notes">
                  {visibleNotes.map((note) => {
                    const title = note.name.replace(/\.md$/i, "");
                    const active = activePath === note.path;
                    return (
                      <li key={note.path} style={{ borderBottom: `1px solid ${figma.border}` }}>
                        {renaming === note.path ? (
                          <div className="px-4 py-2.5">
                            <Input
                              className="h-9"
                              value={renameValue}
                              autoFocus
                              onChange={(event) => setRenameValue(event.target.value)}
                              onBlur={() => void commitRename(note.path)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void commitRename(note.path);
                                if (event.key === "Escape") setRenaming(null);
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            className="group flex min-w-0 items-start"
                            style={{
                              backgroundColor: active ? figma.select : "transparent",
                            }}
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 px-4 py-2.5 text-left"
                              onClick={() => openNote(note.path)}
                              onDoubleClick={() =>
                                startRename({
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
                                className={cn(
                                  "truncate text-[13px]",
                                  active ? "font-medium" : "font-normal",
                                )}
                                style={{ color: figma.ink }}
                              >
                                {title}
                              </p>
                              <p className="mt-1 text-[11px]" style={{ color: figma.muted }}>
                                {note.excerpt ||
                                  (note.modifiedAt
                                    ? formatModifiedLabel(note.modifiedAt)
                                    : "Local note")}
                              </p>
                            </button>
                            <div className="shrink-0 py-2 pr-2 opacity-0 group-hover:opacity-100">
                              <ItemActionsMenu label={title} actions={noteActions(note)} />
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
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
      {undoTrash ? (
        <TrashUndoBar
          fileCount={1}
          reclaimLabel={undoTrash.size > 0 ? formatBytes(undoTrash.size) : undefined}
          busy={undoBusy}
          onUndo={() => void undoTrashAction()}
          onDismiss={() => void dismissTrashUndo()}
        />
      ) : null}
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
