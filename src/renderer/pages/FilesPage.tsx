import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import type { FileEntry, TreeNode } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { FolderTree } from "./FolderTree";
import { FilePreview } from "./FilePreview";

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
  const { workspace, setCurrentFolder, updateSettings, addRecentFile } = useWorkspace();
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

  const view = workspace.settings.filesView;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTree, listing] = await Promise.all([
        window.entropy.fs.folderTree(workspace.path),
        window.entropy.fs.listDir(workspace.currentFolder),
      ]);
      setTree(nextTree);
      setEntries(listing);

      const relative = workspace.currentFolder
        .slice(workspace.path.length)
        .replace(/^[/\\]+/, "");
      const parts = relative ? relative.split(/[/\\]/) : [];
      setCrumbs(parts);

      if (selected) {
        const stillThere = listing.find((entry) => entry.path === selected.path);
        setSelected(stillThere ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read folder");
    } finally {
      setLoading(false);
    }
  }, [workspace.path, workspace.currentFolder, selected]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.path, workspace.currentFolder]);

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

  async function openEntry(entry: FileEntry): Promise<void> {
    if (entry.isDirectory) {
      setCurrentFolder(entry.path);
      setSelected(null);
      return;
    }
    setSelected(entry);
    addRecentFile(entry.path);
  }

  async function goToCrumb(index: number): Promise<void> {
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

  async function handleDelete(entry: FileEntry): Promise<void> {
    if (!window.confirm(`Move "${entry.name}" to the system trash?`)) return;
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

  async function moveToFolder(sourcePath: string, folderPath: string): Promise<void> {
    if (sourcePath === folderPath) return;
    const name = sourcePath.split(/[/\\]/).pop();
    if (!name) return;
    try {
      const target = await window.entropy.fs.join(folderPath, name);
      if (await window.entropy.fs.exists(target)) {
        setError("An item with that name already exists in the destination.");
        return;
      }
      await window.entropy.fs.rename(sourcePath, target);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move");
    }
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
    await moveToFolder(source, folderPath);
  }

  return (
    <main className="content-area files-page" aria-label="Files">
      <aside className="files-tree-pane">
        <div className="pane-header">
          <h2>Folders</h2>
        </div>
        <button
          type="button"
          className={`tree-root${workspace.currentFolder === workspace.path ? " is-active" : ""}${dragOverPath === workspace.path ? " is-drop-target" : ""}`}
          onClick={() => setCurrentFolder(workspace.path)}
          onDragOver={(event) => onDragOver(event, workspace.path)}
          onDragLeave={() => setDragOverPath(null)}
          onDrop={(event) => void onDrop(event, workspace.path)}
        >
          {workspace.name}
        </button>
        <FolderTree
          nodes={tree}
          activePath={workspace.currentFolder}
          onSelect={setCurrentFolder}
        />
      </aside>

      <section
        className="files-main-pane"
        onDragOver={(event) => onDragOver(event, workspace.currentFolder)}
        onDrop={(event) => void onDrop(event, workspace.currentFolder)}
      >
        <div className="files-toolbar">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button type="button" onClick={() => void goToCrumb(-1)}>
              {workspace.name}
            </button>
            {crumbs.map((part, index) => (
              <span key={`${part}-${index}`} className="breadcrumb-item">
                <span className="breadcrumb-sep">/</span>
                <button type="button" onClick={() => void goToCrumb(index)}>
                  {part}
                </button>
              </span>
            ))}
          </nav>

          <div className="files-toolbar-actions">
            <input
              type="search"
              placeholder="Filter files…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Filter files"
            />
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              aria-label="Sort by"
            >
              <option value="name">Name</option>
              <option value="modified">Modified</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setSortAsc((value) => !value)}
            >
              {sortAsc ? "Asc" : "Desc"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => updateSettings({ filesView: view === "list" ? "grid" : "list" })}
            >
              {view === "list" ? "Grid" : "List"}
            </button>
          </div>
        </div>

        {error ? <p className="inline-error">{error}</p> : null}
        {loading ? <p className="pane-empty">Loading…</p> : null}
        {!loading && visible.length === 0 ? <p className="pane-empty">This folder is empty.</p> : null}

        {view === "list" ? (
          <div className="files-list" role="table" aria-label="Files">
            <div className="files-list-header" role="row">
              <span>Name</span>
              <span>Modified</span>
              <span>Size</span>
              <span>Type</span>
            </div>
            {visible.map((entry) => (
              <button
                key={entry.path}
                type="button"
                draggable
                className={`files-list-row${selected?.path === entry.path ? " is-selected" : ""}${entry.isDirectory && dragOverPath === entry.path ? " is-drop-target" : ""}`}
                onClick={() => void openEntry(entry)}
                onDragStart={(event) => onDragStart(event, entry)}
                onDragOver={
                  entry.isDirectory ? (event) => onDragOver(event, entry.path) : undefined
                }
                onDrop={
                  entry.isDirectory ? (event) => void onDrop(event, entry.path) : undefined
                }
              >
                <span className="files-name">
                  {entry.isDirectory ? "[dir] " : ""}
                  {entry.name}
                </span>
                <span>{formatDate(entry.modifiedAt)}</span>
                <span>{entry.isDirectory ? "—" : formatBytes(entry.size)}</span>
                <span>{entry.isDirectory ? "Folder" : entry.extension || "File"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="files-grid">
            {visible.map((entry) => (
              <button
                key={entry.path}
                type="button"
                draggable
                className={`files-grid-card${selected?.path === entry.path ? " is-selected" : ""}${entry.isDirectory && dragOverPath === entry.path ? " is-drop-target" : ""}`}
                onClick={() => void openEntry(entry)}
                onDragStart={(event) => onDragStart(event, entry)}
                onDragOver={
                  entry.isDirectory ? (event) => onDragOver(event, entry.path) : undefined
                }
                onDrop={
                  entry.isDirectory ? (event) => void onDrop(event, entry.path) : undefined
                }
              >
                <span className="files-grid-icon">
                  {entry.isDirectory
                    ? "DIR"
                    : entry.extension.replace(".", "").toUpperCase() || "FILE"}
                </span>
                <span className="files-grid-name">{entry.name}</span>
                <span className="files-grid-meta">
                  {entry.isDirectory ? "Folder" : formatBytes(entry.size)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="files-meta-pane">
        {selected && !selected.isDirectory ? (
          <div className="files-meta files-preview-panel">
            <h2>Preview</h2>
            {renaming ? (
              <input
                className="note-rename-input"
                value={renameValue}
                autoFocus
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void commitRename();
                  if (event.key === "Escape") setRenaming(false);
                }}
              />
            ) : (
              <p className="files-meta-name">{selected.name}</p>
            )}

            <div className="file-actions">
              <button type="button" onClick={() => startRename(selected)}>
                Rename
              </button>
              <button type="button" onClick={() => void handleDuplicate(selected)}>
                Duplicate
              </button>
              <button type="button" onClick={() => void handleDelete(selected)}>
                Delete
              </button>
              <button type="button" onClick={() => void window.entropy.fs.reveal(selected.path)}>
                Reveal
              </button>
              <button
                type="button"
                onClick={() => void window.entropy.fs.openExternal(selected.path)}
              >
                Open
              </button>
            </div>

            <FilePreview file={selected} />
            <dl>
              <div>
                <dt>Path</dt>
                <dd>{selected.path}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{selected.extension || "File"}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(selected.size)}</dd>
              </div>
              <div>
                <dt>Modified</dt>
                <dd>{formatDate(selected.modifiedAt)}</dd>
              </div>
            </dl>
            <p className="pane-empty">Drag files onto folders to move them.</p>
          </div>
        ) : selected?.isDirectory ? (
          <div className="files-meta">
            <h2>Folder</h2>
            <p className="files-meta-name">{selected.name}</p>
            <div className="file-actions">
              <button type="button" onClick={() => startRename(selected)}>
                Rename
              </button>
              <button type="button" onClick={() => void handleDuplicate(selected)}>
                Duplicate
              </button>
              <button type="button" onClick={() => void handleDelete(selected)}>
                Delete
              </button>
              <button type="button" onClick={() => void window.entropy.fs.reveal(selected.path)}>
                Reveal
              </button>
            </div>
          </div>
        ) : (
          <div className="content-empty">
            <h1>Files</h1>
            <p>Select a file to preview and manage it.</p>
          </div>
        )}
      </aside>
    </main>
  );
}
