import { FolderOpen, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { WorkspaceSelection } from '../../shared/workspace';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { usePages } from '../hooks/usePages';
import Button from './ui/button';
import ConfirmDialog from './ConfirmDialog';
import PageEditor, { type PageEditorHandle } from './PageEditor';
import PageSidebar from './PageSidebar';
import SearchPanel from './SearchPanel';

interface WorkspaceViewProps {
  workspace: WorkspaceSelection;
  onChangeWorkspace: () => void;
}

export default function WorkspaceView({ workspace, onChangeWorkspace }: WorkspaceViewProps) {
  const {
    pages,
    activePage,
    draftContent,
    draftTitle,
    loading,
    saving,
    dirty,
    error,
    createPage,
    selectPage,
    selectAdjacentPage,
    updateContent,
    updateTitle,
    renameActivePage,
    deleteActivePage,
    flushSave,
    setError
  } = usePages(workspace);

  const editorRef = useRef<PageEditorHandle | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const shortcuts = useMemo(
    () => ({
      onNewPage: () => {
        void createPage();
      },
      onSave: () => {
        void flushSave();
      },
      onDelete: () => {
        if (activePage) {
          setConfirmDelete(true);
        }
      },
      onNextPage: () => {
        void selectAdjacentPage(1);
      },
      onPrevPage: () => {
        void selectAdjacentPage(-1);
      },
      onLinkFile: () => {
        void editorRef.current?.linkFile();
      },
      onSearch: () => {
        setSearchOpen(true);
      },
      onEscape: () => {
        setSearchOpen(false);
        setConfirmDelete(false);
        setConfirmLeave(false);
      }
    }),
    [activePage, createPage, flushSave, selectAdjacentPage]
  );

  useKeyboardShortcuts(shortcuts, !loading);

  async function handleLeaveWorkspace() {
    if (dirty) {
      const saved = await flushSave();
      if (!saved) {
        setConfirmLeave(true);
        return;
      }
    }
    onChangeWorkspace();
  }

  async function confirmLeaveAnyway() {
    setConfirmLeave(false);
    onChangeWorkspace();
  }

  async function confirmDeletePage() {
    setConfirmDelete(false);
    await deleteActivePage();
  }

  return (
    <section className="flex h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col animate-enter pt-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-entropy-muted">
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">{workspace.name}</span>
            {dirty ? (
              <span className="rounded-full border border-entropy-border px-2 py-0.5 text-[11px]">Unsaved</span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-entropy-muted/80">{workspace.path}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="min-h-10 px-4 py-2 text-xs"
            onClick={() => setSearchOpen(true)}
            title="Search pages (Ctrl/Cmd+K)"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </Button>
          <Button
            variant="secondary"
            className="min-h-10 px-4 py-2 text-xs"
            onClick={() => void handleLeaveWorkspace()}
          >
            Change workspace
          </Button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button type="button" className="text-xs underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-entropy-border bg-entropy-panel">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-entropy-muted">Loading pages…</div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[240px_1fr]">
            <PageSidebar
              pages={pages}
              activePageId={activePage?.id ?? null}
              onSelect={(pageId) => void selectPage(pageId)}
              onCreate={() => void createPage()}
            />
            <PageEditor
              ref={editorRef}
              workspacePath={workspace.path}
              page={activePage}
              title={draftTitle}
              content={draftContent}
              saving={saving}
              dirty={dirty}
              onTitleChange={updateTitle}
              onTitleBlur={(title) => void renameActivePage(title)}
              onContentChange={updateContent}
              onDeleteRequest={() => setConfirmDelete(true)}
              onError={setError}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this page?"
        description={
          activePage
            ? `“${activePage.title}” will be permanently removed from disk (${activePage.fileName}). This cannot be undone.`
            : 'This page will be permanently removed from disk.'
        }
        confirmLabel="Delete page"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmDeletePage()}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Leave without saving?"
        description="The latest changes could not be saved. Leave the workspace anyway?"
        confirmLabel="Leave anyway"
        danger
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => void confirmLeaveAnyway()}
      />

      <SearchPanel
        open={searchOpen}
        workspacePath={workspace.path}
        onClose={() => setSearchOpen(false)}
        onSelect={(pageId) => void selectPage(pageId)}
        onError={setError}
      />
    </section>
  );
}
