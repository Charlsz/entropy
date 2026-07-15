import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SearchHit } from '../../shared/search';

interface SearchPanelProps {
  open: boolean;
  workspacePath: string;
  onClose: () => void;
  onSelect: (pageId: string) => void;
  onError: (message: string | null) => void;
}

export default function SearchPanel({ open, workspacePath, onClose, onSelect, onError }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery('');
    setHits([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(async () => {
      const result = await window.entropy.searchPages(workspacePath, { query: trimmed, limit: 40 });
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        onError(result.error);
        setHits([]);
      } else {
        setHits(result.data);
      }
      setSearching(false);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, onError, query, workspacePath]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh]" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search pages"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-entropy-border bg-entropy-panel shadow-subtle animate-enter"
      >
        <div className="flex items-center gap-3 border-b border-entropy-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-entropy-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles and note contents…"
            className="w-full bg-transparent text-sm text-entropy-text outline-none placeholder:text-entropy-muted"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-entropy-muted hover:bg-entropy-panelSoft hover:text-entropy-text"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!query.trim() ? (
            <p className="px-3 py-6 text-center text-sm text-entropy-muted">
              Type to search across Markdown pages in this workspace.
            </p>
          ) : searching ? (
            <p className="px-3 py-6 text-center text-sm text-entropy-muted">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-entropy-muted">No matches for “{query.trim()}”.</p>
          ) : (
            <ul className="space-y-1">
              {hits.map((hit) => (
                <li key={hit.pageId}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(hit.pageId);
                      onClose();
                    }}
                    className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-entropy-panelSoft"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-entropy-text">{hit.title}</span>
                      <span className="shrink-0 text-[11px] text-entropy-muted">
                        {hit.matchCount} match{hit.matchCount === 1 ? '' : 'es'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-entropy-muted">{hit.fileName}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-entropy-muted/90">{hit.snippet}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
