import React from 'react';
import { FavoriteItem } from './types';
import { useApp } from '../shell/AppContext';

export function FavoritesList({ items }: { items: FavoriteItem[] }) {
  const { navigate } = useApp();

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">No favorites yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() =>
            item.kind === 'book' && item.bookId
              ? navigate('book', { bookId: item.bookId, bookTitle: item.label })
              : undefined
          }
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted w-10 shrink-0">
            {item.kind === 'book' ? 'Book' : 'File'}
          </span>
          <span className="flex-1 text-sm text-text-primary">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
