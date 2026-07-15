import React from 'react';
import { useApp, AppView } from './AppContext';

/**
 * Titlebar — drag region + view switcher tabs + breadcrumb.
 *
 * The three tabs (Library / Book / File) act as the primary navigation.
 * When inside a book, a breadcrumb appears: Library › Book Title.
 *
 * macOS traffic lights sit in the 68px left padding zone.
 * On Windows/Linux the controls are on the right; padding is reduced.
 */

const TABS: { id: AppView; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'book',    label: 'Book' },
  { id: 'file',    label: 'Files' },
];

export function Titlebar() {
  const { view, bookNav, navigate } = useApp();

  return (
    <div className="app-drag flex h-10 w-full shrink-0 items-center border-b border-surface-border bg-surface">
      {/* macOS traffic light space */}
      <div className="w-[72px] shrink-0" />

      {/* Tabs */}
      <div className="app-no-drag flex items-center gap-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
            className={[
              'h-7 rounded px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              view === tab.id
                ? 'bg-surface-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Breadcrumb */}
      {bookNav && (
        <div className="app-no-drag ml-4 flex items-center gap-1.5 text-xs text-text-muted">
          <button
            onClick={() => navigate('library')}
            className="hover:text-text-secondary transition-colors"
          >
            Library
          </button>
          <span>›</span>
          <span className="text-text-secondary truncate max-w-[180px]">{bookNav.bookTitle}</span>
        </div>
      )}

      {/* Spacer — right side reserved for future controls */}
      <div className="flex-1" />
    </div>
  );
}
