/**
 * search() — pure query function.
 *
 * Takes the pre-built index and a query string.
 * Returns ranked results: title matches before body matches.
 *
 * Performance:
 *   Array.filter + includes() on 10k items: ~2–5ms in V8.
 *   Good enough. Switch to an inverted index if corpus grows.
 *
 * Max results: 20 — a palette should never show more than fits on screen.
 */

import { SearchableItem, SearchResult } from './types';

const MAX_RESULTS = 20;

export function search(
  index: SearchableItem[],
  query: string
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const titleMatches: SearchResult[] = [];
  const bodyMatches:  SearchResult[] = [];

  for (const item of index) {
    const inTitle = item.title.toLowerCase().includes(q);
    const inBody  = !inTitle && item.searchText.includes(q);

    if (inTitle) {
      titleMatches.push({ ...item, matchedIn: 'title' });
    } else if (inBody) {
      bodyMatches.push({ ...item, matchedIn: 'body' });
    }

    if (titleMatches.length + bodyMatches.length >= MAX_RESULTS) break;
  }

  return [...titleMatches, ...bodyMatches].slice(0, MAX_RESULTS);
}
