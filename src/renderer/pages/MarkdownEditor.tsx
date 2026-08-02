import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { X, PenLine, Columns2, Eye } from "lucide-react";
import type { NoteSearchResult } from "../../shared/types";
import { registerFlush } from "../state/flushRegistry";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { MarkdownPreview } from "../components/MarkdownPreview";
import {
  LiveMarkdownEditor,
  type LiveMarkdownEditorHandle,
} from "../components/LiveMarkdownEditor";
import { NoteCover } from "../components/NoteCover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../lib/utils";
import { parseNoteFrontmatter } from "../lib/noteMeta";
import { isLiveEmbedExt } from "../lib/markdownBlocks";
import { rewriteMarkdownHref } from "../lib/linkRepair";
import { useWorkspace } from "../state/useWorkspace";

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
  onOpenLocalPath?: (absolutePath: string) => void;
}

export interface MarkdownEditorHandle {
  insertMarkdown: (markdown: string) => void;
  rewriteHref: (from: string, to: string | null) => void;
}

type SurfaceMode = "edit" | "preview";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    { openPaths, activePath, onActiveChange, onCloseTab, onStatsChange, onOpenLocalPath },
    ref,
  ) {
  const { workspace } = useWorkspace();
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [surface, setSurface] = useState<SurfaceMode>("edit");
  const [split, setSplit] = useState(false);
  const [backlinks, setBacklinks] = useState<NoteSearchResult[]>([]);
  const mode = split ? "split" : surface;
  const saveTimers = useRef(new Map<string, number>());
  const tabsRef = useRef(tabs);
  const liveEditorRef = useRef<LiveMarkdownEditorHandle>(null);
  const activePathRef = useRef(activePath);
  const openKey = openPaths.join("\0");

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

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
  const noteMeta = useMemo(
    () => parseNoteFrontmatter(activeTab?.content ?? ""),
    [activeTab?.content],
  );

  useEffect(() => {
    if (!activePath) {
      setBacklinks([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void window.entropy.fs
        .findBacklinks(workspace.path, activePath)
        .then((items) => {
          if (!cancelled) setBacklinks(items);
        })
        .catch(() => {
          if (!cancelled) setBacklinks([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [activePath, workspace.path, activeTab?.savedContent]);

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
    const linkLabel =
      backlinks.length === 1 ? "1 backlink" : `${backlinks.length} backlinks`;
    onStatsChange(`${linkLabel} · ${words} words · ${chars} characters · ${saveState}`);
  }, [activeTab, isDirty, onStatsChange, backlinks.length]);

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

  useImperativeHandle(
    ref,
    () => ({
      insertMarkdown(markdown: string) {
        const path = activePathRef.current;
        if (!path) return;
        const tab = tabsRef.current.find((item) => item.path === path);
        if (!tab || tab.missing || tab.conflict) return;

        setSplit(false);
        setSurface("edit");
        window.requestAnimationFrame(() => {
          liveEditorRef.current?.insertMarkdown(markdown);
        });
      },
      rewriteHref(from: string, to: string | null) {
        const path = activePathRef.current;
        if (!path) return;
        const tab = tabsRef.current.find((item) => item.path === path);
        if (!tab || tab.missing || tab.conflict) return;
        const next = rewriteMarkdownHref(tab.content, from, to);
        if (next === tab.content) return;
        setTabs((prev) =>
          prev.map((item) =>
            item.path === path ? { ...item, content: next, conflict: false } : item,
          ),
        );
        scheduleSave(path, next);
      },
    }),
    [scheduleSave],
  );

  function handleClose(path: string): void {
    const timer = saveTimers.current.get(path);
    if (timer) window.clearTimeout(timer);
    const tab = tabsRef.current.find((item) => item.path === path);
    if (tab && tab.content !== tab.savedContent && !tab.missing) {
      void persistTab(tab);
    }
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
    if (!activeTab || activeTab.missing) return;
    const noteDir = await window.entropy.fs.dirname(activeTab.path);
    const relative = await window.entropy.fs.relative(noteDir, filePath);
    const name = await window.entropy.fs.basename(filePath);
    const info = await window.entropy.fs.stat(filePath);
    const snippet = isLiveEmbedExt(info.extension)
      ? `![${name}](${relative})`
      : `[${name}](${relative})`;
    liveEditorRef.current?.insertMarkdown(snippet);
  }

  if (openPaths.length === 0) {
    return (
      <Empty>
        <EmptyTitle>Open a note</EmptyTitle>
        <EmptyDescription>Pick one from the list, or create a new note with +.</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="entropy-editor-shell flex h-full min-h-0 flex-col bg-background">
      <div
        className="entropy-chrome-bar entropy-notes-chrome shrink-0 border-b border-border"
        aria-label="Open notes"
      >
        <div
          className="flex min-h-8 min-w-0 flex-1 items-stretch gap-1 overflow-x-auto"
          role="tablist"
        >
          {tabs.map((tab) => {
            const dirty = tab.content !== tab.savedContent;
            const active = tab.path === activePath;
            return (
              <div
                key={tab.path}
                className={cn(
                  "group flex max-w-[12rem] shrink-0 items-center gap-0.5 border-b-2 px-1 text-xs",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                role="tab"
                aria-selected={active}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate px-1 py-1.5 text-left"
                  onClick={() => onActiveChange(tab.path)}
                >
                  {tab.title}
                  {dirty ? " ·" : ""}
                  {tab.missing ? " !" : ""}
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 opacity-0 hover:bg-ink-2 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Close ${tab.title}`}
                  onClick={() => handleClose(tab.path)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 text-muted-foreground",
                  !split && surface === "preview" && "bg-ink-2 text-foreground",
                )}
                aria-label={surface === "edit" ? "Show preview" : "Show editor"}
                aria-pressed={!split && surface === "preview"}
                onClick={() => {
                  setSplit(false);
                  setSurface((prev) => (prev === "edit" ? "preview" : "edit"));
                }}
              >
                {surface === "edit" ? (
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <PenLine className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {surface === "edit" ? "Preview" : "Editor"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "entropy-split-toggle h-8 w-8 text-muted-foreground",
                  split && "bg-ink-2 text-foreground",
                )}
                aria-label="Toggle split view"
                aria-pressed={split}
                onClick={() => setSplit((prev) => !prev)}
              >
                <Columns2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Split</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {statusMessage || activeTab?.missing || activeTab?.conflict ? (
        <div
          className="flex items-center justify-between gap-3 border-b border-border bg-secondary px-4 py-2 text-xs"
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
        <p className="px-4 py-4 text-sm text-muted-foreground">Loading note…</p>
      ) : activeTab?.missing ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
          <h1 className="text-lg font-medium">Note unavailable</h1>
          <p className="text-sm text-muted-foreground">
            It may have been deleted or moved outside Entropy.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {activeTab && noteMeta.cover ? (
            <div className="entropy-prose-pad mx-auto w-full max-w-[720px] pt-6">
              <NoteCover notePath={activeTab.path} coverHref={noteMeta.cover} />
            </div>
          ) : null}
          <div className="entropy-prose-pad mx-auto w-full max-w-[720px] pt-6">
            <h1 className="mb-4 text-left text-3xl font-semibold tracking-tight text-foreground">
              {activeTab?.title}
            </h1>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1",
              mode === "split" ? "entropy-editor-split grid gap-0" : "flex flex-col",
            )}
          >
            {mode !== "preview" ? (
              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto",
                  mode === "split" ? "border-r border-border" : "",
                )}
              >
                <LiveMarkdownEditor
                  ref={liveEditorRef}
                  className={mode === "split" ? "" : "mx-auto max-w-[720px]"}
                  value={activeTab?.content ?? ""}
                  notePath={activeTab?.path}
                  disabled={Boolean(activeTab?.conflict)}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onDropPath={(path) => void insertFileLink(path)}
                />
              </div>
            ) : null}
            {mode !== "edit" ? (
              <ScrollArea className="min-h-0 flex-1">
                <MarkdownPreview
                  content={noteMeta.body}
                  notePath={activeTab?.path}
                  onOpenLocal={onOpenLocalPath}
                />
              </ScrollArea>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
  },
);
