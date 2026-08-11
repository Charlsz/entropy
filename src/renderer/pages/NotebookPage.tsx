import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronDown, FilePlus2, MoreHorizontal } from "lucide-react";
import type { FileEntry, RecentWorkspace } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { MarkdownEditor, type MarkdownEditorHandle } from "../pages/MarkdownEditor";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MoveToDialog } from "../components/MoveToDialog";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { ThreeColumnLayout } from "../components/ThreeColumnLayout";
import { NoteContextPanel } from "../components/NoteContextPanel";
import { WorkspaceExplorerTree } from "../components/WorkspaceExplorerTree";
import { copyPath, moveEntryToFolder, revealPath } from "../lib/itemActions";
import { noteContextIsUseful } from "../lib/noteContext";
import { parentDirOfNote } from "../lib/noteFolderTree";
import { useDirWatch } from "../hooks/useDirWatch";
import { isLiveEmbedExt, linkMarkdown, mediaEmbedMarkdown } from "../lib/markdownBlocks";
import { formatBytes } from "../lib/format";
import { figma } from "../lib/figmaTokens";
import { osTrashName, samePath } from "../lib/platform";
import { revealInFolderLabel } from "../../shared/platform";
import { useAppToasts } from "../components/ToastProvider";

export function NotebookPage({
  pendingNote,
  onPendingNoteHandled,
  pendingReference,
  onPendingReferenceHandled,
  onPickWorkspace,
  needsNotebookWorkspace = false,
}: {
  pendingNote?: string | null;
  onPendingNoteHandled?: () => void;
  pendingReference?: string | null;
  onPendingReferenceHandled?: () => void;
  onPickWorkspace?: (path: string) => void;
  needsNotebookWorkspace?: boolean;
} = {}) {
  const { workspace, addRecentFile, visitNote, openFolder, updateSettings, closeWorkspace } =
    useWorkspace();
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  /** Folder that receives New Note (workspace root or a nested folder). */
  const [createFolderPath, setCreateFolderPath] = useState(workspace.path);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setStatusRight] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingForgetWorkspace, setPendingForgetWorkspace] = useState(false);
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const [contextUseful, setContextUseful] = useState(false);
  const [contextEpoch, setContextEpoch] = useState(0);
  const [diskEpoch, setDiskEpoch] = useState(0);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const activePathRef = useRef<string | null>(null);
  const insertedReferenceKeysRef = useRef(new Set<string>());
  const [queuedReference, setQueuedReference] = useState<string | null>(null);
  const [liveContent, setLiveContent] = useState<string | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const { pushToast } = useAppToasts();
  const openNoteRef = useRef<(path: string) => void>(() => undefined);
  activePathRef.current = activePath;

  useEffect(() => {
    let cancelled = false;
    void window.entropy.workspace.getRecent().then((items) => {
      if (!cancelled) setRecentWorkspaces(items);
    });
    return () => {
      cancelled = true;
    };
  }, [workspace.path]);

  async function handleOpenWorkspace(): Promise<void> {
    try {
      const selected = await window.entropy.workspace.open();
      if (selected) onPickWorkspace?.(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open workspace");
    }
  }

  async function handleCreateWorkspace(): Promise<void> {
    try {
      const created = await window.entropy.workspace.create();
      if (created) onPickWorkspace?.(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    }
  }

  async function handleRenameWorkspace(): Promise<void> {
    const nextName = window.prompt("Rename workspace", workspace.name)?.trim();
    if (!nextName || nextName === workspace.name) return;
    try {
      const renamed = await window.entropy.workspace.rename(workspace.path, nextName);
      onPickWorkspace?.(renamed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename workspace");
    }
  }

  async function confirmForgetWorkspace(): Promise<void> {
    setPendingForgetWorkspace(false);
    try {
      await window.entropy.workspace.removeRecent(workspace.path);
      closeWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove workspace");
    }
  }

  useEffect(() => {
    setCreateFolderPath(workspace.path);
    setOpenPaths([]);
    setActivePath(null);
    setPreviewEntry(null);
  }, [workspace.path]);

  const bumpDisk = useCallback(() => {
    setDiskEpoch((value) => value + 1);
    setContextEpoch((value) => value + 1);
  }, []);

  useDirWatch(
    workspace.path,
    () => {
      bumpDisk();
    },
    {
      // Stay live even while Inventory is focused (sections keep-alive).
      recursive: true,
      enabled: Boolean(workspace.path) && !needsNotebookWorkspace,
    },
  );

  // Slow safety net if directory watch drops events (Obsidian/Windows).
  useEffect(() => {
    if (!workspace.path || needsNotebookWorkspace) return;
    const timer = window.setInterval(() => {
      setDiskEpoch((value) => value + 1);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [workspace.path, needsNotebookWorkspace]);

  useEffect(() => {
    if (!pendingNote) return;
    setOpenPaths([pendingNote]);
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

      setOpenPaths([notePath]);
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
    if (!pendingReference || needsNotebookWorkspace) return;
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
            bumpDisk();
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
    bumpDisk,
    workspace.path,
    needsNotebookWorkspace,
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

  function openNoteLocal(notePath: string): void {
    // One note at a time — the workspace tree is the switcher (no tab strip).
    setPreviewEntry(null);
    setOpenPaths([notePath]);
    setActivePath(notePath);
    setCreateFolderPath(parentDirOfNote(notePath, workspace.path));
    addRecentFile(notePath);
  }

  function openNote(notePath: string): void {
    openNoteLocal(notePath);
    visitNote(notePath);
  }
  openNoteRef.current = openNote;

  function handleTreeOpenFile(entry: FileEntry): void {
    if (entry.extension.toLowerCase() === ".md") {
      openNote(entry.path);
      return;
    }
    setPreviewEntry(entry);
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
      const targetDir = createFolderPath || workspace.path;
      const created = await window.entropy.fs.createNote(targetDir);
      openNote(created);
      bumpDisk();
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
      await window.entropy.fs.remove(notePath);
      const paths = [notePath];
      const trash = osTrashName();
      const size = info?.size ?? 0;
      pushToast({
        title: `Moved to ${trash}`,
        detail: size > 0 ? formatBytes(size) : undefined,
        actionLabel: "Undo",
        showOpenTrash: true,
        onAction: async () => {
          const result = await window.entropy.fs.undoRemove(paths);
          if (result.restored === 0) {
            throw new Error(`Couldn't restore the note. It may already be gone from ${trash}.`);
          }
          bumpDisk();
          const restored = paths[0];
          if (restored) openNoteRef.current(restored);
        },
        onDismiss: () => {
          void window.entropy.fs.finalizeTrash(paths).catch(() => undefined);
        },
      });
      setError(null);
      bumpDisk();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
      bumpDisk();
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
      bumpDisk();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move item");
    }
  }

  function noteActions(note: { path: string }): Array<{
    label: string;
    onSelect: () => void;
    destructive?: boolean;
    separatorBefore?: boolean;
  }> {
    const osRevealLabel = revealInFolderLabel(window.entropy.platform).replace(/^Show in\s+/i, "");
    return [
      { label: "Copy path", onSelect: () => void copyPath(note.path) },
      {
        label: "Show in Folders",
        onSelect: () => {
          void (async () => {
            const dir = await window.entropy.fs.dirname(note.path);
            updateSettings({ libraryPerspective: "folders", intelligenceView: null });
            openFolder(dir);
          })();
        },
      },
      {
        label: "Show in Gallery",
        onSelect: () => {
          void (async () => {
            const dir = await window.entropy.fs.dirname(note.path);
            updateSettings({ libraryPerspective: "gallery", intelligenceView: null });
            openFolder(dir);
          })();
        },
      },
      {
        label: `Show in ${osRevealLabel}`,
        onSelect: () => void revealPath(note.path),
      },
      {
        label: "Move to…",
        separatorBefore: true,
        onSelect: () => setMovingPath(note.path),
      },
      {
        label: "Delete",
        destructive: true,
        onSelect: () => requestDelete(note.path),
      },
    ];
  }

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

  if (needsNotebookWorkspace) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <ThreeColumnLayout
          id="notebook-layout"
          persistLayout={false}
          context={null}
          sidebar={
            <div
              className="flex h-full min-h-0 w-full flex-col"
              style={{ backgroundColor: figma.surface, borderRight: `1px solid ${figma.border}` }}
            >
              <div className="flex items-center gap-1.5 px-4 py-2">
                <span
                  className="min-w-0 flex-1 truncate text-[13px] font-semibold"
                  style={{ color: figma.ink }}
                >
                  Notebook
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center px-4 pb-8">
                <Empty className="py-8">
                  <EmptyTitle>Open a workspace</EmptyTitle>
                  <EmptyDescription>
                    Pick a folder for notes, or create a new workspace on disk.
                  </EmptyDescription>
                </Empty>
                <div className="mt-2 flex flex-col gap-2 px-2">
                  <Button type="button" variant="outline" onClick={() => void handleOpenWorkspace()}>
                    Open workspace…
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void handleCreateWorkspace()}>
                    Create new…
                  </Button>
                </div>
                {error ? (
                  <p className="mt-3 px-2 text-sm text-muted-foreground">{error}</p>
                ) : null}
              </div>
            </div>
          }
          main={
            <Empty className="h-full">
              <EmptyTitle>Choose a workspace</EmptyTitle>
              <EmptyDescription>
                Open or create a workspace to write Markdown notes.
              </EmptyDescription>
            </Empty>
          }
        />
      </div>
    );
  }

  const activeNoteName = activePath
    ? (activePath.split(/[/\\]/).pop()?.replace(/\.md$/i, "") ?? "note")
    : null;
  const activeNoteActions = activePath ? noteActions({ path: activePath }) : [];

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
            <div className="flex items-center gap-1.5 px-4 py-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-left outline-none hover:bg-transparent hover:text-foreground focus-visible:bg-transparent"
                    style={{ color: figma.ink }}
                    aria-label="Switch workspace"
                    onClick={() => setCreateFolderPath(workspace.path)}
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-[13px] font-semibold"
                      title={workspace.name}
                    >
                      {workspace.name}
                    </span>
                    <ChevronDown
                      className="size-3.5 shrink-0"
                      style={{ color: figma.muted }}
                      strokeWidth={1.75}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[14rem]">
                  {recentWorkspaces.map((item) => {
                    const active = samePath(item.path, workspace.path);
                    return (
                      <DropdownMenuItem
                        key={item.path}
                        disabled={active || !onPickWorkspace}
                        onSelect={() => onPickWorkspace?.(item.path)}
                      >
                        <span className="truncate">{item.name}</span>
                      </DropdownMenuItem>
                    );
                  })}
                  {recentWorkspaces.length > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem
                    disabled={!onPickWorkspace}
                    onSelect={() => void handleOpenWorkspace()}
                  >
                    Open workspace…
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!onPickWorkspace}
                    onSelect={() => void handleCreateWorkspace()}
                  >
                    New workspace…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleRenameWorkspace()}>
                    Rename “{workspace.name}”…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-muted-foreground"
                    onSelect={() => setPendingForgetWorkspace(true)}
                  >
                    Remove from list
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {activePath ? (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                          aria-label={`Actions for ${activeNoteName}`}
                        >
                          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Note actions</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="min-w-[11rem]">
                    {activeNoteActions.flatMap((action) => {
                      const item = (
                        <DropdownMenuItem
                          key={action.label}
                          className={action.destructive ? "text-muted-foreground" : undefined}
                          onSelect={() => action.onSelect()}
                        >
                          {action.label}
                        </DropdownMenuItem>
                      );
                      if (!action.separatorBefore) return [item];
                      return [
                        <DropdownMenuSeparator key={`${action.label}-sep`} />,
                        item,
                      ];
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    aria-label="New note"
                    onClick={() => void handleCreate()}
                  >
                    <FilePlus2 className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {samePath(createFolderPath, workspace.path)
                    ? "New note"
                    : `New note in ${createFolderPath.split(/[/\\]/).pop() || "folder"}`}
                </TooltipContent>
              </Tooltip>
            </div>

            {error ? <p className="px-4 pb-2 text-sm text-muted-foreground">{error}</p> : null}

            <WorkspaceExplorerTree
              rootPath={workspace.path}
              rootLabel={workspace.name}
              activeFilePath={previewEntry?.path ?? activePath}
              createFolderPath={createFolderPath}
              diskEpoch={diskEpoch}
              onOpenFolder={setCreateFolderPath}
              onOpenFile={handleTreeOpenFile}
            />
          </div>
        }
        main={
          <MarkdownEditor
            ref={editorRef}
            openPaths={openPaths}
            activePath={activePath}
            diskEpoch={diskEpoch}
            onCloseTab={closeTab}
            onNotePathChange={(fromPath, toPath) => {
              setOpenPaths((prev) => prev.map((path) => (path === fromPath ? toPath : path)));
              setActivePath((current) => (current === fromPath ? toPath : current));
              bumpDisk();
              visitNote(toPath);
            }}
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
      <ConfirmDialog
        open={pendingForgetWorkspace}
        title={`Remove “${workspace.name}” from the list?`}
        description="Removes this workspace from Entropy’s recent list. Files stay on disk."
        confirmLabel="Remove"
        onConfirm={() => void confirmForgetWorkspace()}
        onOpenChange={(open) => {
          if (!open) setPendingForgetWorkspace(false);
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
