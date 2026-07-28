import { useCallback, useEffect, useState } from "react";
import { FilePlus2, FolderOpen } from "lucide-react";
import type { FileEntry, NoteSearchResult, TreeNode } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { FolderTree } from "../pages/FolderTree";
import { MarkdownEditor } from "../pages/MarkdownEditor";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { StatusBar } from "../components/StatusBar";
import { ItemActionsMenu } from "../components/ItemActionsMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";

export function NotebookPage({
  pendingNote,
  onPendingNoteHandled,
}: {
  pendingNote?: string | null;
  onPendingNoteHandled?: () => void;
} = {}) {
  const { workspace, setCurrentFolder, addRecentFile, closeWorkspace } = useWorkspace();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [notes, setNotes] = useState<FileEntry[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NoteSearchResult[] | null>(null);
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusRight, setStatusRight] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTree, markdown] = await Promise.all([
        window.entropy.fs.folderTree(workspace.path),
        window.entropy.fs.listMarkdown(workspace.currentFolder),
      ]);
      setTree(nextTree);
      setNotes(markdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [workspace.path, workspace.currentFolder]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pendingNote) return;
    setOpenPaths((prev) => (prev.includes(pendingNote) ? prev : [...prev, pendingNote]));
    setActivePath(pendingNote);
    onPendingNoteHandled?.();
  }, [pendingNote, onPendingNoteHandled]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void window.entropy.fs
        .searchMarkdown(workspace.path, query)
        .then(setSearchResults)
        .catch(() => setSearchResults([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, workspace.path]);

  function openNote(notePath: string): void {
    setOpenPaths((prev) => (prev.includes(notePath) ? prev : [...prev, notePath]));
    setActivePath(notePath);
    addRecentFile(notePath);
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
      const created = await window.entropy.fs.createNote(workspace.currentFolder);
      openNote(created);
      await refresh();
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
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  function startRename(note: FileEntry): void {
    setRenaming(note.path);
    setRenameValue(note.name.replace(/\.md$/i, ""));
  }

  async function commitRename(notePath: string): Promise<void> {
    const nextName = renameValue.trim().replace(/\.md$/i, "");
    setRenaming(null);
    if (!nextName) return;
    try {
      const dir = await window.entropy.fs.dirname(notePath);
      const target = await window.entropy.fs.join(dir, `${nextName}.md`);
      if (target === notePath) return;
      if (await window.entropy.fs.exists(target)) {
        setError("A note with that name already exists.");
        return;
      }
      await window.entropy.fs.rename(notePath, target);
      setOpenPaths((prev) => prev.map((path) => (path === notePath ? target : path)));
      if (activePath === notePath) setActivePath(target);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename note");
    }
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[280px] shrink-0 flex-col border-r border-border bg-ink-2">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Explorer
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="New note"
              onClick={() => void handleCreate()}
            >
              <FilePlus2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-3 pb-2">
            <Input
              type="search"
              placeholder="Filter notes…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 bg-background"
            />
          </div>

          <ScrollArea className="min-h-0 flex-1 px-2">
            <button
              type="button"
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                workspace.currentFolder === workspace.path && "bg-accent text-foreground",
              )}
              onClick={() => setCurrentFolder(workspace.path)}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{workspace.name}</span>
            </button>
            <FolderTree
              nodes={tree}
              activePath={workspace.currentFolder}
              onSelect={setCurrentFolder}
            />

            <Separator className="my-2" />

            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Notes
            </p>

            {error ? <p className="px-2 text-xs text-paper-2">{error}</p> : null}
            {loading ? (
              <div className="space-y-2 px-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-5/6" />
                <Skeleton className="h-8 w-4/5" />
              </div>
            ) : null}
            {!loading && visibleNotes.length === 0 ? (
              <Empty className="py-8">
                <EmptyTitle>No notes here</EmptyTitle>
                <EmptyDescription>Create a markdown note to get started.</EmptyDescription>
              </Empty>
            ) : null}

            <ul className="space-y-0.5 pb-4">
              {visibleNotes.map((note) => (
                <li
                  key={note.path}
                  className={cn(
                    "flex items-center gap-0.5 rounded-lg pr-0.5",
                    activePath === note.path && "bg-accent",
                  )}
                >
                  {renaming === note.path ? (
                    <Input
                      className="h-8"
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
                        className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-sm text-foreground"
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
                      >
                        {note.name.replace(/\.md$/i, "")}
                      </button>
                      <ItemActionsMenu
                        label={note.name.replace(/\.md$/i, "")}
                        actions={[
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
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => requestDelete(note.path),
                          },
                        ]}
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>

          <div className="flex items-center gap-1 border-t border-border px-2 py-2">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={closeWorkspace}
              title="Switch workspace"
            >
              <span className="truncate">{workspace.name}</span>
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-background">
          <MarkdownEditor
            openPaths={openPaths}
            activePath={activePath}
            onActiveChange={(notePath) => {
              setOpenPaths((prev) => (prev.includes(notePath) ? prev : [...prev, notePath]));
              setActivePath(notePath);
              addRecentFile(notePath);
            }}
            onCloseTab={closeTab}
            onStatsChange={setStatusRight}
          />
        </section>
      </div>
      <StatusBar left={activePath ?? workspace.path} right={statusRight} />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Move to trash?"
        description={
          pendingDelete
            ? `Move "${pendingDelete.split(/[/\\]/).pop() ?? "note"}" to the system trash?`
            : "Move this note to the system trash?"
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
