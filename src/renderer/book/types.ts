/**
 * Book domain types.
 *
 * A Book contains Chapters.
 * A Chapter contains Pages.
 * A Page has content (Markdown string) and embedded file references.
 *
 * FileRef is defined here minimally — expanded in commit 5 (Books ↔ Files).
 */

export interface FileRef {
  id: string;
  path: string;
  type: 'image' | 'pdf' | 'video' | 'audio' | 'document' | 'other';
  name: string;
}

export interface Page {
  id: string;
  title: string;
  content: string;   // Markdown string
  files: FileRef[];
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  title: string;
  pages: Page[];
}
