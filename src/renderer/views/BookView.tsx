import React, { useState } from 'react';
import { BookSidebar }  from '../book/BookSidebar';
import { EditorArea }   from '../book/EditorArea';
import { STUB_CHAPTERS } from '../book/stubs';
import { Page }          from '../book/types';

/**
 * BookView — layout root for the notebook editor.
 *
 * Owns:
 *   - which chapter is expanded
 *   - which page is active
 *   - the current page content (in memory until storage is wired)
 */
export function BookView() {
  const [chapters]      = useState(STUB_CHAPTERS);
  const [activePage, setActivePage] = useState<Page | null>(
    chapters[0]?.pages[0] ?? null
  );
  const [content, setContent] = useState(activePage?.content ?? '');

  function handleSelectPage(page: Page) {
    setActivePage(page);
    setContent(page.content);
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <BookSidebar
        chapters={chapters}
        activePage={activePage}
        onSelectPage={handleSelectPage}
      />
      <EditorArea
        page={activePage}
        content={content}
        onChange={setContent}
      />
    </div>
  );
}
