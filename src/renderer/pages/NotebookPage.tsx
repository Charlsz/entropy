import { useCallback, useEffect, useRef, useState } from "react";
import { FilePlus2 } from "lucide-react";
import type { FileEntry, NoteSearchResult } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { MarkdownEditor, type MarkdownEditorHandle } from "../pages/MarkdownEditor";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { StatusBar } from "../components/StatusBar";
import { ItemActionsMenu } from "../components/ItemActionsMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MoveToDialog } from "../components/MoveToDialog";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
import { ThreeColumnLayout } from "../components/ThreeColumnLayout";
import { NoteContextPanel } from "../components/NoteContextPanel";
import { NotebookLibrary } from "../components/NotebookLibrary";
import { buildEntryActions, copyPath, moveEntryToFolder, revealPath } from "../lib/itemActions";
import { useDirWatch } from "../hooks/useDirWatch";
import { isLiveEmbedExt } from "../lib/markdownBlocks";
import { osTrashName } from "../lib/platform";
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
  const [statusRight, setStatusRight] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const editorRef = useRef<MarkdownEditorHandle>(null);

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
    },
    {
      recursive: true,
      enabled: Boolean(workspace.path) && workspace.currentSection === "notebook",
    },
  );

  useEffect(() => {
    if (!pendingNote) return;
    setOpenPaths((prev) => (prev.includes(pendingNote) ? prev : [...prev, pendingNote]));
    setActivePath(pendingNote);
    onPendingNoteHandled?.();
  }, [pendingNote, onPendingNoteHandled]);

  useEffect(() => {
    if (!pendingReference) return;
    let cancelled = false;
    void (async () => {
      try {
        const entry = await window.entropy.fs.stat(pendingReference);
        if (cancelled) return;
        if (!activePath) {
          setError("Open a note before referencing a file.");
          setPreviewEntry(entry);
          return;
        }
        const noteDir = await window.entropy.fs.dirname(activePath);
        const relative = await window.entropy.fs.relative(noteDir, entry.path);
        const hrefSource =
          /[:/\\]/.test(relative) && relative.includes(":")
            ? entry.path
            : relative || entry.path;
        const href = hrefSource.replace(/\\/g, "/");
        const label = entry.isDirectory ? entry.name : entry.name.replace(/\.md$/i, "");
        const insert = isLiveEmbedExt(entry.extension)
          ? `![${label}](${/\s/.test(href) ? `<${href}>` : href})`
          : `[${label}](${/\s/.test(href) ? `<${href}>` : href})`;
        editorRef.current?.insertMarkdown(insert);
        setPreviewEntry(entry);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to reference file");
        }
      } finally {
        if (!cancelled) onPendingReferenceHandled?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingReference, activePath, onPendingReferenceHandled]);

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
      await window.entropy.fs.remove(notePath);
      closeTab(notePath);
      await refreshNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
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
        ? `![${label}](${href})`
        : `[${label}](${href})`;
      editorRef.current?.insertMarkdown(insert);
      setPreviewEntry(entry);
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
      }))
    : notes.map((note) => ({
        path: note.path,
        name: note.name,
        excerpt: "",
      }));

  const context =
    activePath || previewEntry ? (
      <NoteContextPanel
        notePath={activePath}
        previewEntry={previewEntry}
        onOpenNote={openNote}
        onReference={(entry) => void referenceEntry(entry)}
        onClearPreview={() => setPreviewEntry(null)}
        onRewriteHref={(from, to) => editorRef.current?.rewriteHref(from, to)}
      />
    ) : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <ThreeColumnLayout
        id="notebook-layout"
        persistLayout={workspace.currentSection === "notebook"}
        context={context}
        sidebar={
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <Input
                type="search"
                placeholder="Filter notes…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Filter notes"
                className="h-8 min-w-0 flex-1 bg-background"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="New note"
                aria-label="New note"
                onClick={() => void handleCreate()}
              >
                <FilePlus2 className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1 px-3">
              {error ? <p className="px-2 pb-2 text-sm text-paper-2">{error}</p> : null}
              {loading ? (
                <div className="space-y-2 px-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : null}
              {!loading && visibleNotes.length === 0 ? (
                <Empty className="py-6">
                  <EmptyTitle>No notes yet</EmptyTitle>
                  <EmptyDescription>Use + to create a note and start writing.</EmptyDescription>
                </Empty>
              ) : null}

              <ul className="space-y-1 pb-3">
                {visibleNotes.map((note) => (
                  <li
                    key={note.path}
                    className={cn(
                      "group flex min-w-0 items-center gap-1 rounded-md pr-1",
                      activePath === note.path && "bg-accent",
                    )}
                  >
                    {renaming === note.path ? (
                      <Input
                        className="h-9 min-w-0"
                        value={renameValue}
                        autoFocus
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={() => void commitRename(note.path)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void commitRename(note.path);
                          if (event.key === "Escape") setRenaming(null);
                        }}
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm text-foreground"
                          onClick={() => openNote(note.path)}
                          onDoubleClick={() =>
                            startRename({
                              name: note.name,
                              path: note.path,
                              isDirectory: false,
                              size: 0,
                              modifiedAt: 0,
                              extension: ".md",
                            })
                          }
                          title={note.name.replace(/\.md$/i, "")}
                        >
                          {note.name.replace(/\.md$/i, "")}
                        </button>
                        <div
                          className={cn(
                            "shrink-0 transition-opacity duration-150",
                            activePath === note.path
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                          )}
                        >
                          <ItemActionsMenu
                            label={note.name.replace(/\.md$/i, "")}
                            actions={noteActions(note)}
                          />
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>

              <Separator className="my-2" />

              <NotebookLibrary
                rootPath={workspace.path}
                rootName={workspace.name}
                selectedPath={previewEntry?.path ?? null}
                renamingPath={renaming}
                renameValue={renameValue}
                onRenameValueChange={setRenameValue}
                onCommitRename={(path) => void commitRename(path)}
                onCancelRename={() => setRenaming(null)}
                onSelect={setPreviewEntry}
                onReference={(entry) => void referenceEntry(entry)}
                onOpenNote={openNote}
                onRename={(entry) => startRename(entry)}
                onCopyPath={(entry) => void copyPath(entry.path)}
                onReveal={(entry) => void revealPath(entry.path)}
                onMoveTo={(entry) => setMovingPath(entry.path)}
                onDelete={(entry) => {
                  if (entry.extension.toLowerCase() === ".md" && !entry.isDirectory) {
                    requestDelete(entry.path);
                    return;
                  }
                  void (async () => {
                    try {
                      await window.entropy.fs.remove(entry.path);
                      if (previewEntry?.path === entry.path) setPreviewEntry(null);
                      await refreshNotes();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to delete");
                    }
                  })();
                }}
              />
            </ScrollArea>
          </div>
        }
        main={
          <MarkdownEditor
            ref={editorRef}
            openPaths={openPaths}
            activePath={activePath}
            onActiveChange={(notePath) => {
              openNoteLocal(notePath);
              visitNote(notePath);
            }}
            onCloseTab={closeTab}
            onStatsChange={setStatusRight}
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
      <StatusBar left={activePath ?? workspace.path} right={statusRight} />
      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? `Delete “${pendingDelete.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "note"}”?`
            : "Delete note?"
        }
        description={`Moves to ${osTrashName()}. Recover until emptied.`}
        confirmLabel="Delete"
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
