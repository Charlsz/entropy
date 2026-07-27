import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import type { FileEntry } from "../../shared/types";
import { FilePreview } from "./FilePreview";

interface EditorTab {
  path: string;
  title: string;
  content: string;
  savedContent: string;
  loading: boolean;
}

interface MarkdownEditorProps {
  openPaths: string[];
  activePath: string | null;
  onActiveChange: (path: string) => void;
  onCloseTab: (path: string) => void;
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function MarkdownEditor({
  openPaths,
  activePath,
  onActiveChange,
  onCloseTab,
}: MarkdownEditorProps) {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [linkedFile, setLinkedFile] = useState<FileEntry | null>(null);
  const saveTimers = useRef(new Map<string, number>());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const openKey = openPaths.join("\0");

  useEffect(() => {
    let cancelled = false;

    setTabs((prev) => {
      const kept = prev.filter((tab) => openPaths.includes(tab.path));
      const additions = openPaths
        .filter((filePath) => !kept.some((tab) => tab.path === filePath))
        .map((filePath) => ({
          path: filePath,
          title: filePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "Untitled",
          content: "",
          savedContent: "",
          loading: true,
        }));
      return [...kept, ...additions];
    });

    void (async () => {
      for (const filePath of openPaths) {
        try {
          const content = await window.entropy.fs.readText(filePath);
          if (cancelled) return;
          setTabs((prev) =>
            prev.map((tab) => {
              if (tab.path !== filePath) return tab;
              if (!tab.loading && tab.content !== tab.savedContent) return tab;
              return {
                ...tab,
                content,
                savedContent: content,
                loading: false,
                title: filePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "Untitled",
              };
            }),
          );
        } catch {
          if (cancelled) return;
          setTabs((prev) =>
            prev.map((tab) =>
              tab.path === filePath
                ? { ...tab, content: "", savedContent: "", loading: false }
                : tab,
            ),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openKey, openPaths]);

  const activeTab = tabs.find((tab) => tab.path === activePath) ?? null;
  const isDirty = activeTab ? activeTab.content !== activeTab.savedContent : false;

  const links = useMemo(() => {
    if (!activeTab) return [] as { label: string; href: string }[];
    const found: { label: string; href: string }[] = [];
    LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK_RE.exec(activeTab.content)) !== null) {
      found.push({ label: match[1], href: match[2] });
    }
    return found;
  }, [activeTab]);

  const scheduleSave = useCallback((filePath: string, content: string) => {
    const existing = saveTimers.current.get(filePath);
    if (existing) window.clearTimeout(existing);

    const timer = window.setTimeout(() => {
      void window.entropy.fs.writeText(filePath, content).then(() => {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.path === filePath ? { ...tab, savedContent: content } : tab,
          ),
        );
      });
    }, 450);

    saveTimers.current.set(filePath, timer);
  }, []);

  function handleChange(value: string): void {
    if (!activePath) return;
    setTabs((prev) =>
      prev.map((tab) => (tab.path === activePath ? { ...tab, content: value } : tab)),
    );
    scheduleSave(activePath, value);
  }

  function handleClose(path: string): void {
    const timer = saveTimers.current.get(path);
    if (timer) window.clearTimeout(timer);
    const tab = tabs.find((item) => item.path === path);
    if (tab && tab.content !== tab.savedContent) {
      void window.entropy.fs.writeText(path, tab.content);
    }
    if (linkedFile) setLinkedFile(null);
    onCloseTab(path);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!activeTab) return;
      void window.entropy.fs.writeText(activeTab.path, activeTab.content).then(() => {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.path === activeTab.path
              ? { ...tab, savedContent: activeTab.content }
              : tab,
          ),
        );
      });
    }
  }

  async function insertFileLink(filePath: string): Promise<void> {
    if (!activeTab || !textareaRef.current) return;
    const noteDir = await window.entropy.fs.dirname(activeTab.path);
    const relative = await window.entropy.fs.relative(noteDir, filePath);
    const name = await window.entropy.fs.basename(filePath);
    const snippet = `[${name}](${relative})`;

    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next =
      activeTab.content.slice(0, start) + snippet + activeTab.content.slice(end);
    handleChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function onDrop(event: DragEvent<HTMLTextAreaElement>): Promise<void> {
    event.preventDefault();
    const entropyPath = event.dataTransfer.getData("application/x-entropy-path");
    if (entropyPath) {
      await insertFileLink(entropyPath);
      return;
    }

    // OS file drops are not copied — we only reference existing paths when available via entropy DnD.
  }

  async function openLinked(href: string): Promise<void> {
    if (!activeTab) return;
    if (/^(https?:|mailto:)/i.test(href)) {
      return;
    }

    try {
      const noteDir = await window.entropy.fs.dirname(activeTab.path);
      const absolute = await window.entropy.fs.join(noteDir, href);
      if (!(await window.entropy.fs.exists(absolute))) {
        setLinkedFile(null);
        return;
      }
      const info = await window.entropy.fs.stat(absolute);
      if (info.isDirectory) {
        await window.entropy.fs.reveal(absolute);
        return;
      }
      if (info.extension === ".md") {
        onActiveChange(absolute);
        return;
      }
      setLinkedFile(info);
    } catch {
      setLinkedFile(null);
    }
  }

  if (openPaths.length === 0) {
    return (
      <div className="content-empty">
        <h1>Notebook</h1>
        <p>Select a note or create a new markdown file.</p>
      </div>
    );
  }

  return (
    <div className="editor-shell editor-with-links">
      <div className="editor-main">
        <div className="editor-tabs" role="tablist" aria-label="Open notes">
          {tabs.map((tab) => {
            const dirty = tab.content !== tab.savedContent;
            return (
              <div
                key={tab.path}
                className={`editor-tab${tab.path === activePath ? " is-active" : ""}`}
                role="tab"
                aria-selected={tab.path === activePath}
              >
                <button
                  type="button"
                  className="editor-tab-button"
                  onClick={() => onActiveChange(tab.path)}
                >
                  <span>
                    {tab.title}
                    {dirty ? " •" : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="editor-tab-close"
                  aria-label={`Close ${tab.title}`}
                  onClick={() => handleClose(tab.path)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div className="editor-status">
          <span>{activeTab?.title ?? ""}</span>
          <span>{isDirty ? "Unsaved" : "Saved"}</span>
        </div>

        {activeTab?.loading ? (
          <p className="pane-empty">Loading note…</p>
        ) : (
          <textarea
            ref={textareaRef}
            className="markdown-editor"
            value={activeTab?.content ?? ""}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void onDrop(event)}
            spellCheck
            aria-label="Markdown editor"
          />
        )}
      </div>

      <aside className="editor-links-pane">
        <div className="pane-header">
          <h2>Linked files</h2>
        </div>
        {links.length === 0 ? (
          <p className="pane-empty">Drag files from Files into the note to insert relative links.</p>
        ) : (
          <ul className="linked-file-list">
            {links.map((link) => (
              <li key={`${link.label}-${link.href}`}>
                <button type="button" onClick={() => void openLinked(link.href)}>
                  <span className="note-name">{link.label}</span>
                  <span className="note-excerpt">{link.href}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {linkedFile ? (
          <div className="linked-preview">
            <div className="pane-header">
              <h2>Preview</h2>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => void window.entropy.fs.openExternal(linkedFile.path)}
              >
                Open
              </button>
            </div>
            <FilePreview file={linkedFile} />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
