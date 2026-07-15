import React from 'react';
import { LibrarySection } from './LibrarySidebar';
import { BookGrid }       from './BookGrid';
import { RecentList }     from './RecentList';
import { FavoritesList }  from './FavoritesList';
import { STUB_BOOKS, STUB_RECENT, STUB_FAVORITES } from './stubs';

interface Props {
  section: LibrarySection;
  query: string;
}

export function LibraryContent({ section, query }: Props) {
  const filteredBooks = STUB_BOOKS.filter((b) =>
    b.title.toLowerCase().includes(query.toLowerCase()) ||
    (b.description ?? '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-8 py-8">
      {section === 'all' && (
        <>
          <h2 className="mb-6 text-xl font-semibold tracking-tight text-text-primary">
            {query ? `Results for “${query}”` : 'Your Library'}
          </h2>
          <BookGrid books={filteredBooks} />
        </>
      )}

      {section === 'recent' && (
        <>
          <h2 className="mb-6 text-xl font-semibold tracking-tight text-text-primary">Recent</h2>
          <RecentList files={STUB_RECENT} />
        </>
      )}

      {section === 'favorites' && (
        <>
          <h2 className="mb-6 text-xl font-semibold tracking-tight text-text-primary">Favorites</h2>
          <FavoritesList items={STUB_FAVORITES} />
        </>
      )}
    </div>
  );
}
