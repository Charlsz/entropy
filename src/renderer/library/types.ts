/**
 * Data contracts for the Library.
 *
 * Using plain types (not classes) keeps serialization trivial.
 * These will be the shape of JSON files on disk once storage is wired.
 */

export interface Book {
  id: string;
  title: string;
  description?: string;
  coverColor: string;   // CSS color string — covers are colored, not images, for now
  pageCount: number;
  updatedAt: string;    // ISO date string
  tags: string[];
}

export interface RecentFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'video' | 'audio' | 'document' | 'other';
  path: string;
  accessedAt: string;
  bookId?: string;
  bookTitle?: string;
}

export interface FavoriteItem {
  id: string;
  kind: 'book' | 'file';
  label: string;
  bookId?: string;
  filePath?: string;
}
