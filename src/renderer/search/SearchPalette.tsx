import React, { useEffect, useRef, useState } from 'react';
import { SearchResult } from './types';
import { SearchResultRow } from './SearchResultRow';
import { useApp }     from '../shell/AppContext';

interface Props {
  open: boolean;
  query: string;
  results: SearchResult[];
  onQuery: (q: string) => void;
  onClose: () => void;
}

/**
 * SearchPalette — Raycast-style command palette overlay.
 *
 * Layout:
 *   Semi-transparent backdrop (click to close)
 *   Centered modal (max-w-xl)
 *     Search input (auto-focused)
 *     Results list (arrow key navigation)
 *
 * Keyboard:
 *   ArrowUp / ArrowDown — navigate results
 *   Enter — select active result
 *   Escape — close
 */
export function SearchPalette({ open, query, results, onQuery, onClose }: Props) {
  const { navigate } = useApp();
  const inputRef     = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);

  // Reset active index when results change
  useEffect(() => setActive(0), [results]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[active]) selectResult(results[active]);
        break;
      case 'Escape':
        onClose();
        break;
    }
  }

  function selectResult(result: SearchResult) {
    onClose();
    switch (result.kind) {
      case 'book':
        if (result.bookId) navigate('book', { bookId: result.bookId, bookTitle: result.title });
        break;
      case 'page':
        if (result.bookId) navigate('book', { bookId: result.bookId, bookTitle: result.bookTitle ?? '' });
        break;
      case 'file':
        navigate('file');
        break;
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-surface-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-text-muted shrink-0">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search books, pages, files…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          {query && (
            <button
              onClick={() => onQuery('')}
              className="text-xs text-text-muted hover:text-text-secondary"
            >
              Clear
            </button>
          )}
          <kbd className="text-xs text-text-muted border border-surface-border rounded px-1.5 py-0.5">esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-80 overflow-y-auto py-1">
            {results.map((result, i) => (
              <SearchResultRow
                key={result.id}
                result={result}
                active={i === active}
                query={query}
                onSelect={() => selectResult(result)}
                onHover={() => setActive(i)}
              />
            ))}
          </div>
        ) : query ? (
          <div className="py-8 text-center text-sm text-text-muted">
            No results for “{query}”
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-text-muted">
            Start typing to search…
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-surface-border px-4 py-2">
          <span className="text-xs text-text-muted">
            <kbd className="border border-surface-border rounded px-1 py-0.5">↵</kbd> select
          </span>
          <span className="text-xs text-text-muted">
            <kbd className="border border-surface-border rounded px-1 py-0.5">↑↓</kbd> navigate
          </span>
          <span className="text-xs text-text-muted">
            <kbd className="border border-surface-border rounded px-1 py-0.5">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
