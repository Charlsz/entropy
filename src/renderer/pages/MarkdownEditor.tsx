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
import { Columns2, Eye, PenLine } from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { NoteSearchResult } from "../../shared/types";
import { registerFlush } from "../state/flushRegistry";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { MarkdownPreview } from "../components/MarkdownPreview";
import {
  WysiwygMarkdownEditor,
  type WysiwygMarkdownEditorHandle,
} from "../components/WysiwygMarkdownEditor";
import { NoteFormatToolbar } from "../components/NoteFormatToolbar";
import { NoteCover } from "../components/NoteCover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../lib/utils";
import { parseNoteFrontmatter } from "../lib/noteMeta";
import { isLiveEmbedExt, linkMarkdown, mediaEmbedMarkdown } from "../lib/markdownBlocks";
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
  /** Bumps when workspace files change on disk — recheck open notes + embeds. */
  diskEpoch?: number;
  onCloseTab: (path: string) => void;
  /** Fired after the open note file was renamed on disk. */
  onNotePathChange?: (fromPath: string, toPath: string) => void;
  onStatsChange?: (stats: string) => void;
  /** Fires when the active tab's in-memory markdown changes (before disk save). */
  onLiveContentChange?: (content: string | null) => void;
  onOpenLocalPath?: (absolutePath: string) => void;
}

export interface MarkdownEditorHandle {
  /** Returns false when the active tab is not ready to accept an insert. */
  insertMarkdown: (markdown: string) => boolean;
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
    {
      openPaths,
      activePath,
      diskEpoch = 0,
      onCloseTab,
      onNotePathChange,
      onStatsChange,
      onLiveContentChange,
      onOpenLocalPath,
    },
    ref,
  ) {
  const { workspace } = useWorkspace();
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [surface, setSurface] = useState<SurfaceMode>("edit");
  const [split, setSplit] = useState(false);
  const [backlinks, setBacklinks] = useState<NoteSearchResult[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [tipTapEditor, setTipTapEditor] = useState<Editor | null>(null);
  const mode = split ? "split" : surface;
  const saveTimers = useRef(new Map<string, number>());
  const tabsRef = useRef(tabs);
  const liveEditorRef = useRef<WysiwygMarkdownEditorHandle>(null);
  const activePathRef = useRef(activePath);
  const openKey = openPaths.join("\0");

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  const clearSaveTimer = useCallback((filePath: string) => {
    const pending = saveTimers.current.get(filePath);
    if (pending) {
      window.clearTimeout(pending);
      saveTimers.current.delete(filePath);
    }
  }, []);

  /** Disk is the source of truth — apply file bytes immediately, no Reload click. */
  const applyDiskSnapshot = useCallback(
    (filePath: string, content: string, mtimeMs: number) => {
      clearSaveTimer(filePath);
      const title = filePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "Untitled";
      setTabs((prev) =>
        prev.map((item) =>
          item.path === filePath
            ? {
                ...item,
                title,
                content,
                savedContent: content,
                mtimeMs,
                missing: false,
                conflict: false,
              }
            : item,
        ),
      );
      if (activePathRef.current === filePath) setStatusMessage(null);
    },
    [clearSaveTimer],
  );

  const persistTab = useCallback(
    async (tab: EditorTab): Promise<void> => {
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
        clearSaveTimer(tab.path);
        setTabs((prev) =>
          prev.map((item) =>
            item.path === tab.path ? { ...item, missing: true, conflict: false } : item,
          ),
        );
        setStatusMessage("This note was deleted or moved on disk.");
        return;
      }

      // Someone else wrote first — take disk instantly (no Reload button).
      try {
        const content = await window.entropy.fs.readText(tab.path);
        const info = await window.entropy.fs.stat(tab.path);
        applyDiskSnapshot(tab.path, content, info.modifiedAt);
      } catch {
        clearSaveTimer(tab.path);
        setTabs((prev) =>
          prev.map((item) =>
            item.path === tab.path ? { ...item, missing: true, conflict: false } : item,
          ),
        );
      }
    },
    [applyDiskSnapshot, clearSaveTimer],
  );

  const syncOpenTabsFromDisk = useCallback(async () => {
    const paths = tabsRef.current.filter((tab) => !tab.loading).map((tab) => tab.path);
    for (const filePath of paths) {
      const tab = tabsRef.current.find((item) => item.path === filePath);
      if (!tab || tab.loading) continue;
      try {
        const exists = await window.entropy.fs.exists(tab.path);
        if (!exists) {
          if (!tab.missing) {
            clearSaveTimer(tab.path);
            setTabs((prev) =>
              prev.map((item) =>
                item.path === tab.path
                  ? { ...item, missing: true, conflict: false }
                  : item,
              ),
            );
            if (activePathRef.current === tab.path) {
              setStatusMessage("This note was deleted or moved on disk.");
            }
          }
          continue;
        }

        const info = await window.entropy.fs.stat(tab.path);
        const latest = tabsRef.current.find((item) => item.path === filePath) ?? tab;
        const diskNewer =
          latest.mtimeMs == null || Math.abs(info.modifiedAt - latest.mtimeMs) > 1;

        if (!diskNewer && !latest.missing) continue;

        const content = await window.entropy.fs.readText(latest.path);
        if (
          !latest.missing &&
          content === latest.content &&
          content === latest.savedContent &&
          !latest.conflict
        ) {
          // Touch-only mtime change (or we already match disk).
          setTabs((prev) =>
            prev.map((item) =>
              item.path === latest.path
                ? { ...item, mtimeMs: info.modifiedAt, conflict: false, missing: false }
                : item,
            ),
          );
          continue;
        }

        applyDiskSnapshot(latest.path, content, info.modifiedAt);
      } catch {
        // Ignore transient FS errors during a sync tick.
      }
    }
  }, [applyDiskSnapshot, clearSaveTimer]);

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
      const MAX_SOFT_CACHE = 12;
      const openSet = new Set(openPaths);
      const byPath = new Map(prev.map((tab) => [tab.path, tab]));

      for (const filePath of openPaths) {
        if (byPath.has(filePath)) continue;
        byPath.set(filePath, {
          path: filePath,
          title: filePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "Untitled",
          content: "",
          savedContent: "",
          mtimeMs: null,
          loading: true,
          missing: false,
          conflict: false,
        });
      }

      const openTabs = openPaths
        .map((path) => byPath.get(path))
        .filter((tab): tab is EditorTab => Boolean(tab));

      // Soft-cache closed notes so switching back does not flash empty→content.
      const cached = prev
        .filter((tab) => !openSet.has(tab.path) && !tab.loading)
        .slice(-MAX_SOFT_CACHE);

      const next = [...openTabs];
      for (const tab of cached) {
        if (!next.some((item) => item.path === tab.path)) next.push(tab);
      }
      return next;
    });

    void (async () => {
      for (const filePath of openPaths) {
        // Skip disk read when we already have a warm, clean tab for this path.
        const warm = tabsRef.current.find(
          (tab) =>
            tab.path === filePath &&
            !tab.loading &&
            !tab.missing &&
            tab.content === tab.savedContent,
        );
        if (warm) continue;

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

  /** External disk changes: poll + directory watch. Windows/Obsidian atomic saves are flaky on fs.watch alone. */
  useEffect(() => {
    if (openPaths.length === 0) return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      void syncOpenTabsFromDisk();
    };

    tick();
    const timer = window.setInterval(tick, 200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [openKey, openPaths.length, diskEpoch, syncOpenTabsFromDisk]);

  const activeTab = tabs.find((tab) => tab.path === activePath) ?? null;
  const isDirty = activeTab ? activeTab.content !== activeTab.savedContent : false;

  useEffect(() => {
    setTitleDraft(activeTab?.title ?? "");
  }, [activeTab?.path, activeTab?.title]);

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

  useEffect(() => {
    if (!onLiveContentChange) return;
    if (!activeTab || activeTab.loading || activeTab.missing) {
      onLiveContentChange(null);
      return;
    }
    onLiveContentChange(activeTab.content);
  }, [
    activeTab?.path,
    activeTab?.content,
    activeTab?.loading,
    activeTab?.missing,
    onLiveContentChange,
  ]);

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

  // Focus once when a note finishes loading — do not re-steal focus on re-renders.
  useEffect(() => {
    if (mode === "preview") return;
    if (!activeTab || activeTab.loading || activeTab.missing || activeTab.conflict) return;

    const timer = window.setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        if (active.closest(".entropy-editor-shell .ProseMirror")) return;
        if (active.closest(".entropy-note-title")) return;
        if (
          active.closest(
            ".entropy-notes-sidebar input, [data-entropy-search], [role='dialog'] input, [role='dialog'] textarea",
          )
        ) {
          return;
        }
      }
      // Preserve caret; never jump to end (that made scrollbar clicks teleport).
      liveEditorRef.current?.focus();
    }, 40);

    return () => window.clearTimeout(timer);
    // Intentionally only when the open note / surface changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid focus thrash on content edits
  }, [activePath, mode, activeTab?.loading, activeTab?.missing, activeTab?.conflict]);

  useImperativeHandle(
    ref,
    () => ({
      insertMarkdown(markdown: string) {
        const path = activePathRef.current;
        if (!path) return false;
        const tab = tabsRef.current.find((item) => item.path === path);
        if (!tab || tab.loading || tab.missing || tab.conflict) return false;

        setSplit(false);
        setSurface("edit");
        window.requestAnimationFrame(() => {
          liveEditorRef.current?.insertMarkdown(markdown);
        });
        return true;
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

  function handleKeyDown(event: KeyboardEvent): void {
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
    const href = (relative || filePath).replace(/\\/g, "/");
    const snippet = isLiveEmbedExt(info.extension)
      ? mediaEmbedMarkdown(href, name)
      : linkMarkdown(name, href);
    liveEditorRef.current?.insertMarkdown(snippet);
  }

  async function commitTitle(): Promise<void> {
    if (!activeTab || activeTab.missing || activeTab.conflict) return;
    const nextTitle = titleDraft.trim() || "Untitled";
    if (nextTitle === activeTab.title) {
      setTitleDraft(activeTab.title);
      return;
    }
    try {
      const dir = await window.entropy.fs.dirname(activeTab.path);
      const target = await window.entropy.fs.join(dir, `${nextTitle}.md`);
      if (await window.entropy.fs.exists(target)) {
        setStatusMessage("A note with that name already exists.");
        setTitleDraft(activeTab.title);
        return;
      }
      // Persist unsaved body before the path moves.
      if (activeTab.content !== activeTab.savedContent) {
        await persistTab(activeTab);
      }
      await window.entropy.fs.rename(activeTab.path, target);
      const fromPath = activeTab.path;
      setTabs((prev) =>
        prev.map((tab) =>
          tab.path === fromPath
            ? { ...tab, path: target, title: nextTitle }
            : tab,
        ),
      );
      onNotePathChange?.(fromPath, target);
      setStatusMessage(null);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Could not rename note");
      setTitleDraft(activeTab.title);
    }
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
        className="entropy-chrome-bar entropy-notes-chrome flex h-9 shrink-0 items-center border-b border-border"
        aria-label="Note tools"
      >
        {mode !== "preview" ? (
          <NoteFormatToolbar
            editor={tipTapEditor}
            disabled={Boolean(activeTab?.conflict || activeTab?.missing || activeTab?.loading)}
          />
        ) : (
          <div className="min-w-0 flex-1 px-3 text-[12px] text-muted-foreground">Reading view</div>
        )}
        <div className="flex shrink-0 items-center gap-0.5 px-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground",
                  !split && surface === "preview" && "text-foreground",
                )}
                aria-label={surface === "edit" ? "Show reading view" : "Show live preview"}
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
            <TooltipContent side="bottom" sideOffset={8}>
              {surface === "edit" ? "Reading view" : "Live Preview"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "entropy-split-toggle h-8 w-8 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground",
                  split && "text-foreground",
                )}
                aria-label="Toggle split view"
                aria-pressed={split}
                onClick={() => setSplit((prev) => !prev)}
              >
                <Columns2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Split
            </TooltipContent>
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
                Close
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
                <div className="entropy-note-page entropy-prose-pad mx-auto flex w-full max-w-[720px] flex-col pb-24 pt-8">
                  {activeTab && noteMeta.cover ? (
                    <div className="mb-6">
                      <NoteCover notePath={activeTab.path} coverHref={noteMeta.cover} />
                    </div>
                  ) : null}
                  <WysiwygMarkdownEditor
                    ref={liveEditorRef}
                    value={activeTab?.content ?? ""}
                    noteTitle={activeTab?.title ?? ""}
                    notePath={activeTab?.path}
                    diskEpoch={diskEpoch}
                    disabled={Boolean(activeTab?.conflict)}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onDropPath={(path) => void insertFileLink(path)}
                    onEditorReady={setTipTapEditor}
                    titleSlot={
                      <input
                        className="entropy-note-title mb-3 w-full border-0 bg-transparent p-0 text-[1.75rem] font-medium leading-tight tracking-tight text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0"
                        value={titleDraft}
                        disabled={Boolean(activeTab?.conflict || activeTab?.missing)}
                        aria-label="Note title"
                        placeholder="Untitled"
                        spellCheck
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onBlur={() => void commitTitle()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                            liveEditorRef.current?.focus();
                          }
                          if (event.key === "Escape") {
                            setTitleDraft(activeTab?.title ?? "");
                            event.currentTarget.blur();
                          }
                        }}
                      />
                    }
                  />
                </div>
              </div>
            ) : null}
            {mode !== "edit" ? (
              <ScrollArea className="min-h-0 flex-1">
                {mode === "preview" && activeTab && noteMeta.cover ? (
                  <div className="entropy-prose-pad mx-auto w-full max-w-[720px] pt-6">
                    <NoteCover notePath={activeTab.path} coverHref={noteMeta.cover} />
                  </div>
                ) : null}
                {mode === "preview" ? (
                  <div className="entropy-prose-pad mx-auto w-full max-w-[720px] pt-6">
                    <h1 className="mb-4 text-left text-[1.75rem] font-medium leading-tight tracking-tight text-foreground">
                      {activeTab?.title}
                    </h1>
                  </div>
                ) : null}
                <MarkdownPreview
                  content={noteMeta.body}
                  notePath={activeTab?.path}
                  diskEpoch={diskEpoch}
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
