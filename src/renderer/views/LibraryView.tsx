import React, { useState } from 'react';
import { LibrarySidebar, LibrarySection } from '../library/LibrarySidebar';
import { LibraryContent }                 from '../library/LibraryContent';

/**
 * LibraryView — root of the Library state.
 *
 * Owns:
 *   - which section is active (All / Recent / Favorites)
 *   - the search query
 *
 * Passes both down to sidebar (for active highlight) and content (for filtering).
 */
export function LibraryView() {
  const [section, setSection]   = useState<LibrarySection>('all');
  const [query,   setQuery]     = useState('');

  return (
    <div className="flex h-full w-full overflow-hidden">
      <LibrarySidebar
        active={section}
        onSelect={setSection}
        query={query}
        onQuery={setQuery}
      />
      <LibraryContent section={section} query={query} />
    </div>
  );
}
