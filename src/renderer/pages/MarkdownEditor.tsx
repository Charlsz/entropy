import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { X } from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { FilePreview } from "./FilePreview";
import { registerFlush } from "../state/flushRegistry";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { cn } from "../lib/utils";

interface EditorTab {
  path: string;
  title: string;
  content: string;
  savedContent: string;
  mtimeMs: number | null;
  loading: boolean;
  missing: boolean;
  conflict: boolean;
}

interface MarkdownEditorProps {
  openPaths: string[];
  activePath: string | null;
  onActiveChange: (path: string) => void;
  onCloseTab: (path: string) => void;
  onStatsChange?: (stats: string) => void;
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function MarkdownEditor({
  openPaths,
  activePath,
  onActiveChange,
  onCloseTab,
  onStatsChange,
}: MarkdownEditorProps) {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [linkedFile, setLinkedFile] = useState<FileEntry | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const saveTimers = useRef(new Map<string, number>());
  const tabsRef = useRef(tabs);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const openKey = openPaths.join("\0");

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const persistTab = useCallback(async (tab: EditorTab): Promise<void> => {
    if (tab.missing || tab.content === tab.savedContent) return;

    const result = await window.entropy.fs.writeTextSafe(tab.path, tab.content, tab.mtimeMs);

    if (result.ok) {
      setTabs((prev) =>
        prev.map((item) =>
          item.path === tab.path
            ? {
                ...item,
                savedContent: tab.content,
                mtimeMs: result.mtimeMs,
                conflict: false,
                missing: false,
              }
            : item,
        ),
      );
      setStatusMessage(null);
      return;
    }

    if (result.reason === "missing") {
      setTabs((prev) =>
        prev.map((item) =>
          item.path === tab.path ? { ...item, missing: true, conflict: false } : item,
        ),
      );
      setStatusMessage("This note was deleted or moved on disk.");
      return;
    }

    setTabs((prev) =>
      prev.map((item) => (item.path === tab.path ? { ...item, conflict: true } : item)),
    );
    setStatusMessage("This note changed outside Entropy. Reload or overwrite to continue.");
  }, []);

  const flushPending = useCallback(async () => {
    for (const [, timer] of saveTimers.current) {
      window.clearTimeout(timer);
    }
    saveTimers.current.clear();

    const dirty = tabsRef.current.filter(
      (tab) => !tab.missing && tab.content !== tab.savedContent,
    );
    await Promise.all(dirty.map((tab) => persistTab(tab)));
  }, [persistTab]);

  useEffect(() => registerFlush(flushPending), [flushPending]);

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
          mtimeMs: null,
          loading: true,
          missing: false,
          conflict: false,
        }));
      return [...kept, ...additions];
    });

    void (async () => {
      for (const filePath of openPaths) {
        try {
          const exists = await window.entropy.fs.exists(filePath);
          if (!exists) {
            if (cancelled) return;
            setTabs((prev) =>
              prev.map((tab) =>
                tab.path === filePath
                  ? {
                      ...tab,
                      loading: false,
                      missing: true,
                      content: tab.content,
                      savedContent: tab.savedContent,
                    }
                  : tab,
              ),
            );
            continue;
          }

          const [content, info] = await Promise.all([
            window.entropy.fs.readText(filePath),
            window.entropy.fs.stat(filePath),
          ]);
          if (cancelled) return;
          setTabs((prev) =>
            prev.map((tab) => {
              if (tab.path !== filePath) return tab;
              if (!tab.loading && tab.content !== tab.savedContent) return tab;
              return {
                ...tab,
                content,
                savedContent: content,
                mtimeMs: info.modifiedAt,
                loading: false,
                missing: false,
                conflict: false,
                title: filePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "Untitled",
              };
            }),
          );
        } catch {
          if (cancelled) return;
          setTabs((prev) =>
            prev.map((tab) =>
              tab.path === filePath ? { ...tab, loading: false, missing: true } : tab,
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

  useEffect(() => {
    if (!onStatsChange) return;
    if (!activeTab || activeTab.loading || activeTab.missing) {
      onStatsChange("");
      return;
    }
    const words = countWords(activeTab.content);
    const chars = activeTab.content.length;
    const saveState = activeTab.conflict
      ? "Conflict"
      : isDirty
        ? "Unsaved"
        : "Saved";
    onStatsChange(`${words} words · ${chars} characters · ${saveState}`);
  }, [activeTab, isDirty, onStatsChange]);

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

  const scheduleSave = useCallback(
    (filePath: string, content: string) => {
      const existing = saveTimers.current.get(filePath);
      if (existing) window.clearTimeout(existing);

      const timer = window.setTimeout(() => {
        const tab = tabsRef.current.find((item) => item.path === filePath);
        if (!tab) return;
        void persistTab({ ...tab, content });
      }, 450);

      saveTimers.current.set(filePath, timer);
    },
    [persistTab],
  );

  function handleChange(value: string): void {
    if (!activePath) return;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.path === activePath ? { ...tab, content: value, conflict: false } : tab,
      ),
    );
    scheduleSave(activePath, value);
  }

  function handleClose(path: string): void {
    const timer = saveTimers.current.get(path);
    if (timer) window.clearTimeout(timer);
    const tab = tabsRef.current.find((item) => item.path === path);
    if (tab && tab.content !== tab.savedContent && !tab.missing) {
      void persistTab(tab);
    }
    if (linkedFile) setLinkedFile(null);
    onCloseTab(path);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!activeTab || activeTab.missing) return;
      void persistTab(activeTab);
    }
  }

  async function reloadFromDisk(): Promise<void> {
    if (!activeTab) return;
    try {
      const [content, info] = await Promise.all([
        window.entropy.fs.readText(activeTab.path),
        window.entropy.fs.stat(activeTab.path),
      ]);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.path === activeTab.path
            ? {
                ...tab,
                content,
                savedContent: content,
                mtimeMs: info.modifiedAt,
                missing: false,
                conflict: false,
              }
            : tab,
        ),
      );
      setStatusMessage(null);
    } catch {
      setStatusMessage("Could not reload this note from disk.");
    }
  }

  async function overwriteDisk(): Promise<void> {
    if (!activeTab) return;
    const result = await window.entropy.fs.writeTextSafe(
      activeTab.path,
      activeTab.content,
      null,
    );
    if (result.ok) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.path === activeTab.path
            ? {
                ...tab,
                savedContent: activeTab.content,
                mtimeMs: result.mtimeMs,
                conflict: false,
                missing: false,
              }
            : tab,
        ),
      );
      setStatusMessage(null);
    }
  }

  async function insertFileLink(filePath: string): Promise<void> {
    if (!activeTab || !textareaRef.current || activeTab.missing) return;
    const noteDir = await window.entropy.fs.dirname(activeTab.path);
    const relative = await window.entropy.fs.relative(noteDir, filePath);
    const name = await window.entropy.fs.basename(filePath);
    const snippet = `[${name}](${relative})`;

    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = activeTab.content.slice(0, start) + snippet + activeTab.content.slice(end);
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
    }
  }

  async function openLinked(href: string): Promise<void> {
    if (!activeTab) return;
    if (/^(https?:|mailto:)/i.test(href)) return;

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
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <h1 className="text-lg font-medium text-foreground">Notebook</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Select a note or create a new markdown file.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-border bg-[hsl(var(--rail))] px-1"
          role="tablist"
          aria-label="Open notes"
        >
          {tabs.map((tab) => {
            const dirty = tab.content !== tab.savedContent;
            const active = tab.path === activePath;
            return (
              <div
                key={tab.path}
                className={cn(
                  "group flex h-8 max-w-[180px] items-center rounded-t-md border border-b-0 px-1 text-xs",
                  active
                    ? "border-border bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/60",
                )}
                role="tab"
                aria-selected={active}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate px-1.5 py-1 text-left"
                  onClick={() => onActiveChange(tab.path)}
                >
                  {tab.title}
                  {dirty ? " ·" : ""}
                  {tab.missing ? " !" : ""}
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
                  aria-label={`Close ${tab.title}`}
                  onClick={() => handleClose(tab.path)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {statusMessage || activeTab?.missing || activeTab?.conflict ? (
          <div
            className="flex items-center justify-between gap-3 border-b border-border bg-secondary px-3 py-2 text-xs"
            role="status"
          >
            <span className="text-foreground">
              {statusMessage ??
                (activeTab?.missing
                  ? "This note is missing on disk."
                  : "File changed outside Entropy.")}
            </span>
            <div className="flex shrink-0 gap-1">
              {activeTab?.conflict || activeTab?.missing ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void reloadFromDisk()}
                >
                  Reload
                </Button>
              ) : null}
              {activeTab?.conflict ? (
                <Button type="button" size="sm" onClick={() => void overwriteDisk()}>
                  Overwrite
                </Button>
              ) : null}
              {activeTab?.missing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleClose(activeTab.path)}
                >
                  Close tab
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab?.loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading note…</p>
        ) : activeTab?.missing ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <h1 className="text-lg font-medium">Note unavailable</h1>
            <p className="text-sm text-muted-foreground">
              It may have been deleted or moved outside Entropy.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mx-auto w-full max-w-[720px] px-8 pt-8">
              <h1 className="mb-6 text-center text-3xl font-semibold tracking-tight text-foreground">
                {activeTab?.title}
              </h1>
            </div>
            <textarea
              ref={textareaRef}
              className="select-text mx-auto mb-8 min-h-0 w-full max-w-[720px] flex-1 resize-none bg-transparent px-8 pb-16 font-sans text-[15px] leading-7 text-foreground outline-none placeholder:text-muted-foreground"
              value={activeTab?.content ?? ""}
              onChange={(event) => handleChange(event.target.value)}
              onKeyDown={handleKeyDown}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void onDrop(event)}
              spellCheck
              aria-label="Markdown editor"
              disabled={Boolean(activeTab?.conflict)}
            />
          </div>
        )}
      </div>

      <aside className="flex w-[220px] shrink-0 flex-col border-l border-border bg-[hsl(var(--panel))]">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Linked
          </h2>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {links.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              Drag files from Files into the note to insert relative links.
            </p>
          ) : (
            <ul className="space-y-0.5 p-2">
              {links.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <button
                    type="button"
                    className="flex w-full flex-col rounded-lg px-2 py-2 text-left hover:bg-accent"
                    onClick={() => void openLinked(link.href)}
                  >
                    <span className="truncate text-sm text-foreground">{link.label}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{link.href}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {linkedFile ? (
            <div className="border-t border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Preview
                </h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void window.entropy.fs.openExternal(linkedFile.path)}
                >
                  Open
                </Button>
              </div>
              <FilePreview file={linkedFile} />
            </div>
          ) : null}
        </ScrollArea>
      </aside>
    </div>
  );
}
