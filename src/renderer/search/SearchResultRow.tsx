import React from 'react';
import { SearchResult } from './types';

const KIND_LABEL: Record<SearchResult['kind'], string> = {
  book: 'Book',
  page: 'Page',
  file: 'File',
};

interface Props {
  result: SearchResult;
  active: boolean;
  query: string;
  onSelect: () => void;
  onHover: () => void;
}

/**
 * SearchResultRow — a single result in the palette.
 *
 * Highlights the matched query in the title.
 * Shows kind badge + subtitle (book title or file path).
 */
export function SearchResultRow({ result, active, query, onSelect, onHover }: Props) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={[
        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
        active ? 'bg-surface-elevated' : 'hover:bg-surface-elevated',
      ].join(' ')}
    >
      <span className="w-10 shrink-0 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
        {KIND_LABEL[result.kind]}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-text-primary">
          <Highlight text={result.title} query={query} />
        </span>
        {result.subtitle && (
          <span className="truncate text-xs text-text-muted">{result.subtitle}</span>
        )}
      </div>

      {result.matchedIn === 'body' && (
        <span className="shrink-0 text-xs text-text-muted">in body</span>
      )}
    </button>
  );
}

/** Highlight matching substring in a string. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1 || !query) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/20 text-accent rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
