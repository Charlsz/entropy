import React from 'react';
import { AppProvider }    from './shell/AppContext';
import { Titlebar }       from './shell/Titlebar';
import { ViewSlot }       from './shell/ViewSlot';
import { SearchPalette }  from './search/SearchPalette';
import { useSearch }      from './search/useSearch';
import { buildIndex }     from './search/indexer';
import { STUB_BOOKS }     from './library/stubs';
import { STUB_CHAPTERS }  from './book/stubs';
import { STUB_FILES }     from './files/stubs';

/**
 * App.tsx — composition root.
 *
 * Builds the search index once at mount from stub data.
 * When real storage is wired, replace the stubs with live data
 * and call buildIndex() after any mutation.
 *
 * The SearchPalette is mounted at the root so Cmd+K works from any view.
 */

function AppInner() {
  const index = React.useMemo(() => buildIndex({
    books: STUB_BOOKS,
    chaptersByBook: { b6: STUB_CHAPTERS },
    files: STUB_FILES,
  }), []);

  const { open, query, results, handleQuery, close } = useSearch(index);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-text-primary">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <ViewSlot />
      </div>
      <SearchPalette
        open={open}
        query={query}
        results={results}
        onQuery={handleQuery}
        onClose={close}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
