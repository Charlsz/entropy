import React from 'react';
import { Book } from './types';
import { useApp } from '../shell/AppContext';
import { Caption } from '../design-system';

interface Props {
  books: Book[];
}

/**
 * BookGrid — a responsive grid of book cards.
 *
 * Each card shows:
 *   - A colored cover (no images yet — keeps it calm and fast)
 *   - Title
 *   - Description
 *   - Page count + last updated
 *
 * Clicking a book navigates to the Book view.
 * The cover color is stored on the Book record — user-configurable later.
 */
export function BookGrid({ books }: Props) {
  const { navigate } = useApp();

  if (books.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">No books found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
      {books.map((book) => (
        <button
          key={book.id}
          onClick={() => navigate('book', { bookId: book.id, bookTitle: book.title })}
          className="group flex flex-col overflow-hidden rounded-lg border border-surface-border bg-surface text-left transition-colors hover:border-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {/* Cover */}
          <div
            className="h-28 w-full"
            style={{ backgroundColor: book.coverColor }}
          />

          {/* Meta */}
          <div className="flex flex-col gap-1 p-3">
            <span className="text-sm font-medium text-text-primary leading-tight">
              {book.title}
            </span>
            {book.description && (
              <span className="text-xs text-text-muted leading-relaxed line-clamp-2">
                {book.description}
              </span>
            )}
            <Caption className="mt-1">
              {book.pageCount} pages
            </Caption>
          </div>
        </button>
      ))}
    </div>
  );
}
