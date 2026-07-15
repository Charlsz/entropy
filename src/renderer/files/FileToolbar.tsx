import React from 'react';
import { ViewMode } from '../views/FileView';
import { Input } from '../design-system';

interface Props {
  query: string;
  onQuery: (q: string) => void;
  mode: ViewMode;
  onMode: (m: ViewMode) => void;
  count: number;
}

export function FileToolbar({ query, onQuery, mode, onMode, count }: Props) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-surface-border bg-surface px-4">
      <div className="w-64">
        <Input
          placeholder="Search files…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          icon={
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      <span className="flex-1 text-xs text-text-muted">
        {count} {count === 1 ? 'file' : 'files'}
      </span>

      <div className="flex items-center gap-0.5 rounded border border-surface-border p-0.5">
        {(['grid', 'list'] as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={[
              'rounded px-2 py-1 text-xs transition-colors',
              mode === m
                ? 'bg-surface-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary',
            ].join(' ')}
          >
            {m === 'grid' ? '⋯⋯' : '≡'}
          </button>
        ))}
      </div>
    </div>
  );
}
