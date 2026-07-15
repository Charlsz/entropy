import { FileText, Plus } from 'lucide-react';
import type { PageSummary } from '../../shared/pages';
import Button from './ui/button';

interface PageSidebarProps {
  pages: PageSummary[];
  activePageId: string | null;
  onSelect: (pageId: string) => void;
  onCreate: () => void;
}

export default function PageSidebar({ pages, activePageId, onSelect, onCreate }: PageSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-entropy-border bg-entropy-panel/60">
      <div className="flex items-center justify-between gap-2 border-b border-entropy-border px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-entropy-muted">Pages</p>
          <p className="text-sm text-entropy-text">
            {pages.length} note{pages.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button
          variant="secondary"
          className="min-h-9 px-3 py-2 text-xs"
          onClick={onCreate}
          title="New page (Ctrl/Cmd+N)"
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {pages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-entropy-border px-3 py-8 text-center">
            <FileText className="mx-auto mb-3 h-6 w-6 text-entropy-muted" />
            <p className="text-sm leading-6 text-entropy-muted">
              Empty notebook. Press <span className="text-entropy-text">New</span> or{' '}
              <kbd className="rounded border border-entropy-border px-1.5 py-0.5 text-[10px]">Ctrl+N</kbd>.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {pages.map((page) => {
              const active = page.id === activePageId;
              return (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(page.id)}
                    className={[
                      'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'bg-entropy-panelSoft text-entropy-text'
                        : 'text-entropy-muted hover:bg-entropy-panelSoft/70 hover:text-entropy-text'
                    ].join(' ')}
                  >
                    <span className="block truncate text-sm font-medium">{page.title}</span>
                    <span className="mt-0.5 block truncate text-xs opacity-70">{page.fileName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-entropy-border px-3 py-2 text-[11px] leading-5 text-entropy-muted/80">
        <p>
          <kbd className="rounded border border-entropy-border px-1">⌘/Ctrl+K</kbd> search ·{' '}
          <kbd className="rounded border border-entropy-border px-1">⌘/Ctrl+S</kbd> save
        </p>
      </div>
    </aside>
  );
}
