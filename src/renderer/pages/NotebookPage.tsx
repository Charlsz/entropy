import { useCallback, useEffect, useState } from "react";
import type { FileEntry, NoteSearchResult, TreeNode } from "../../shared/types";
import { useWorkspace } from "../state/WorkspaceContext";
import { FolderTree } from "./FolderTree";
import { MarkdownEditor } from "./MarkdownEditor";

export function NotebookPage() {
  const { workspace, setCurrentFolder, addRecentFile } = useWorkspace();
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
      if (activePath === notePath) {
        setActivePath(next[next.length - 1] ?? null);
      }
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

  async function handleDelete(notePath: string): Promise<void> {
    const name = notePath.split(/[/\\]/).pop() ?? "note";
    if (!window.confirm(`Move "${name}" to the system trash?`)) return;

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
    <main className="content-area notebook-page" aria-label="Notebook">
      <aside className="notebook-tree-pane">
        <div className="pane-header">
          <h2>Folders</h2>
        </div>
        <button
          type="button"
          className={`tree-root${workspace.currentFolder === workspace.path ? " is-active" : ""}`}
          onClick={() => setCurrentFolder(workspace.path)}
        >
          {workspace.name}
        </button>
        <FolderTree
          nodes={tree}
          activePath={workspace.currentFolder}
          onSelect={setCurrentFolder}
        />
      </aside>

      <section className="notebook-list-pane">
        <div className="pane-header notebook-toolbar">
          <h2>Notes</h2>
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => void handleCreate()}
          >
            New note
          </button>
        </div>

        <div className="notebook-search">
          <input
            type="search"
            placeholder="Search notes…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search notes"
          />
        </div>

        {error ? <p className="inline-error">{error}</p> : null}
        {loading ? <p className="pane-empty">Loading…</p> : null}

        {!loading && visibleNotes.length === 0 ? (
          <p className="pane-empty">
            {query.trim() ? "No matching notes." : "No markdown notes in this folder."}
          </p>
        ) : null}

        <ul className="note-list">
          {visibleNotes.map((note) => (
            <li key={note.path} className={activePath === note.path ? "is-selected" : ""}>
              {renaming === note.path ? (
                <input
                  className="note-rename-input"
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
                <button type="button" className="note-row" onClick={() => openNote(note.path)}>
                  <span className="note-name">{note.name.replace(/\.md$/i, "")}</span>
                  {note.excerpt ? <span className="note-excerpt">{note.excerpt}</span> : null}
                </button>
              )}
              <div className="note-actions">
                <button
                  type="button"
                  onClick={() =>
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
                  Rename
                </button>
                <button type="button" onClick={() => void handleDelete(note.path)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="notebook-detail-pane">
        <MarkdownEditor
          openPaths={openPaths}
          activePath={activePath}
          onActiveChange={setActivePath}
          onCloseTab={closeTab}
        />
      </section>
    </main>
  );
}
