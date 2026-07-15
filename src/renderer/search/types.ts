/**
 * Search types.
 *
 * SearchableItem: the flat record that gets indexed.
 * SearchResult: a SearchableItem with a matched snippet.
 */

export type SearchItemKind = 'book' | 'page' | 'file';

export interface SearchableItem {
  id: string;
  kind: SearchItemKind;
  title: string;
  subtitle?: string;   // book title for pages, folder for files
  searchText: string;  // pre-lowercased, all fields concatenated

  // Navigation payload
  bookId?: string;
  bookTitle?: string;
  pageId?: string;
  filePath?: string;
}

export interface SearchResult extends SearchableItem {
  matchedIn: 'title' | 'body';  // used for result ranking: title matches first
}
