import React, { createContext, useContext, useState } from 'react';

/**
 * AppContext — the single source of truth for which top-level view is active.
 *
 * Three states:
 *   library — browse books, recent files, favorites
 *   book    — edit a specific notebook
 *   file    — browse the file reference library
 *
 * navigate() is the only way to switch state.
 * Arguments carry the minimum data each view needs to render.
 */

export type AppView = 'library' | 'book' | 'file';

export interface BookNav {
  bookId: string;
  bookTitle: string;
}

export interface AppState {
  view: AppView;
  bookNav: BookNav | null;
}

interface AppContextValue extends AppState {
  navigate: (view: AppView, bookNav?: BookNav) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    view: 'library',
    bookNav: null,
  });

  function navigate(view: AppView, bookNav?: BookNav) {
    setState({
      view,
      bookNav: bookNav ?? (view === 'book' ? state.bookNav : null),
    });
  }

  return (
    <AppContext.Provider value={{ ...state, navigate }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
