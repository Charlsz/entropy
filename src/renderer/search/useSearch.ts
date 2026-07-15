/**
 * useSearch — React hook that manages the search palette lifecycle.
 *
 * - Registers Cmd/Ctrl+K global listener
 * - Holds query string + results
 * - Debounces search by 60ms (1 frame) to avoid blocking on every keystroke
 * - Returns open/close/query handlers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchableItem, SearchResult } from './types';
import { search } from './search';

export function useSearch(index: SearchableItem[]) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global Cmd/Ctrl+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Debounced search
  const handleQuery = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setResults(search(index, q));
      }, 60);
    },
    [index]
  );

  function close() {
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  return { open, query, results, handleQuery, close };
}
