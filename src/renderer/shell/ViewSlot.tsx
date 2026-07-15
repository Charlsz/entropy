import React from 'react';
import { useApp } from './AppContext';

/**
 * ViewSlot — renders the correct top-level view based on AppContext.
 *
 * Why not React.lazy here?
 * All three views are lightweight shells at this stage.
 * We add lazy loading when bundle size becomes a concern.
 *
 * Placeholder components will be replaced as each view is built.
 */

import { LibraryView } from '../views/LibraryView';
import { BookView }    from '../views/BookView';
import { FileView }    from '../views/FileView';

export function ViewSlot() {
  const { view } = useApp();

  switch (view) {
    case 'library': return <LibraryView />;
    case 'book':    return <BookView />;
    case 'file':    return <FileView />;
  }
}
