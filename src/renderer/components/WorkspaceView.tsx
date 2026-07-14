import { FileText, FolderOpen, FolderPlus } from 'lucide-react';
import type { WorkspaceSelection } from '../../shared/workspace';
import Button from './ui/button';

interface WorkspaceViewProps {
  workspace: WorkspaceSelection;
  onChangeWorkspace: () => void;
}

export default function WorkspaceView({ workspace, onChangeWorkspace }: WorkspaceViewProps) {
  return (
    <section className="w-full max-w-3xl animate-enter">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-entropy-muted">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-4 w-4" />
          <span>Workspace ready</span>
        </div>
        <Button variant="secondary" className="min-h-10 px-4 py-2 text-xs" onClick={onChangeWorkspace}>
          Change workspace
        </Button>
      </div>

      <div className="rounded-2xl border border-entropy-border bg-entropy-panel px-8 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-col gap-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-entropy-text sm:text-4xl">
              {workspace.name}
            </h2>
            <p className="break-all text-sm leading-6 text-entropy-muted">{workspace.path}</p>
          </div>

          <div className="rounded-xl border border-dashed border-entropy-border bg-entropy-background/25 px-6 py-12 text-center sm:px-8 sm:py-16">
            <FileText className="mx-auto mb-4 h-8 w-8 text-entropy-muted" />
            <p className="text-2xl font-medium tracking-[-0.03em] text-entropy-text">No notes yet.</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-entropy-muted">
              This workspace is ready. Create your first Markdown note when the next milestone arrives.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="sm:flex-1" disabled>
              <FolderPlus className="h-4 w-4" />
              Create your first note
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
