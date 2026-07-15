/**
 * Indexer — builds the in-memory search index.
 *
 * Called once on app start (and after mutations).
 * Returns a flat array of SearchableItem that the query function filters.
 *
 * Design:
 *   - Pure function: takes data, returns items. No side effects.
 *   - searchText is built once at index time, not at query time.
 *   - Caller decides when to re-index (e.g., after saving a page).
 */

import { SearchableItem } from './types';
import { Book }        from '../library/types';
import { Chapter }     from '../book/types';
import { FileEntry }   from '../files/types';

interface IndexInput {
  books: Book[];
  chaptersByBook: Record<string, Chapter[]>;
  files: FileEntry[];
}

export function buildIndex(input: IndexInput): SearchableItem[] {
  const items: SearchableItem[] = [];

  // Index books
  for (const book of input.books) {
    items.push({
      id:         `book:${book.id}`,
      kind:       'book',
      title:      book.title,
      subtitle:   book.description,
      searchText: `${book.title} ${book.description ?? ''} ${book.tags.join(' ')}`.toLowerCase(),
      bookId:     book.id,
      bookTitle:  book.title,
    });

    // Index pages within each book
    const chapters = input.chaptersByBook[book.id] ?? [];
    for (const chapter of chapters) {
      for (const page of chapter.pages) {
        items.push({
          id:         `page:${page.id}`,
          kind:       'page',
          title:      page.title,
          subtitle:   book.title,
          searchText: `${page.title} ${page.content}`.toLowerCase(),
          bookId:     book.id,
          bookTitle:  book.title,
          pageId:     page.id,
        });
      }
    }
  }

  // Index files
  for (const file of input.files) {
    items.push({
      id:         `file:${file.id}`,
      kind:       'file',
      title:      file.name,
      subtitle:   file.path,
      searchText: `${file.name} ${file.tags.join(' ')} ${file.type}`.toLowerCase(),
      filePath:   file.path,
    });
  }

  return items;
}
