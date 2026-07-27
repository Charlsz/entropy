import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

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

export function MarkdownEditor({
  openPaths,
  activePath,
  onActiveChange,
  onCloseTab,
}: MarkdownEditorProps) {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const saveTimers = useRef(new Map<string, number>());
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

  if (openPaths.length === 0) {
    return (
      <div className="content-empty">
        <h1>Notebook</h1>
        <p>Select a note or create a new markdown file.</p>
      </div>
    );
  }

  return (
    <div className="editor-shell">
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
          className="markdown-editor"
          value={activeTab?.content ?? ""}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck
          aria-label="Markdown editor"
        />
      )}
    </div>
  );
}
