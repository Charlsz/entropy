import { FolderOpen } from 'lucide-react';
import type { WorkspaceSelection } from '../../shared/workspace';
import { usePages } from '../hooks/usePages';
import Button from './ui/button';
import PageEditor from './PageEditor';
import PageSidebar from './PageSidebar';

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
    updateContent,
    updateTitle,
    renameActivePage,
    setError
  } = usePages(workspace);

  return (
    <section className="flex h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col animate-enter pt-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-entropy-muted">
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">{workspace.name}</span>
          </div>
          <p className="mt-1 truncate text-xs text-entropy-muted/80">{workspace.path}</p>
        </div>
        <Button variant="secondary" className="min-h-10 px-4 py-2 text-xs" onClick={onChangeWorkspace}>
          Change workspace
        </Button>
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
              page={activePage}
              title={draftTitle}
              content={draftContent}
              saving={saving}
              dirty={dirty}
              onTitleChange={updateTitle}
              onTitleBlur={(title) => void renameActivePage(title)}
              onContentChange={updateContent}
            />
          </div>
        )}
      </div>
    </section>
  );
}
