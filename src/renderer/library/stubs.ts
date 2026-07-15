/**
 * In-memory stubs — replaced by real storage reads later.
 * Kept in a separate file so components never import storage directly.
 */

import { Book, RecentFile, FavoriteItem } from './types';

export const STUB_BOOKS: Book[] = [
  { id: 'b1', title: 'Design Notes',      description: 'Visual research and system thinking', coverColor: '#1a2a3a', pageCount: 24,  updatedAt: '2026-07-13T10:00:00Z', tags: ['design'] },
  { id: 'b2', title: 'Architecture',      description: 'Software patterns and decisions',     coverColor: '#1a3a2a', pageCount: 12,  updatedAt: '2026-07-12T09:00:00Z', tags: ['engineering'] },
  { id: 'b3', title: 'Reading Log',       description: 'Books, papers, links',                coverColor: '#2a1a3a', pageCount: 48,  updatedAt: '2026-07-10T14:00:00Z', tags: ['reading'] },
  { id: 'b4', title: 'Product Strategy',  description: 'Roadmap and positioning notes',      coverColor: '#3a2a1a', pageCount: 8,   updatedAt: '2026-07-08T11:00:00Z', tags: ['product'] },
  { id: 'b5', title: 'Weekly Reviews',    description: 'Reflection and planning',             coverColor: '#2a3a1a', pageCount: 36,  updatedAt: '2026-07-07T08:00:00Z', tags: ['personal'] },
  { id: 'b6', title: 'Entropy Devlog',    description: 'Building Entropy notes',              coverColor: '#0d1a2a', pageCount: 7,   updatedAt: '2026-07-14T20:00:00Z', tags: ['entropy', 'engineering'] },
];

export const STUB_RECENT: RecentFile[] = [
  { id: 'r1', name: 'moodboard-v3.png',     type: 'image',    path: '/files/moodboard-v3.png',     accessedAt: '2026-07-14T19:00:00Z', bookId: 'b1', bookTitle: 'Design Notes' },
  { id: 'r2', name: 'linear-paper.pdf',     type: 'pdf',      path: '/files/linear-paper.pdf',     accessedAt: '2026-07-14T15:00:00Z', bookId: 'b2', bookTitle: 'Architecture' },
  { id: 'r3', name: 'reference-01.jpg',     type: 'image',    path: '/files/reference-01.jpg',     accessedAt: '2026-07-13T12:00:00Z' },
  { id: 'r4', name: 'system-design.mp4',    type: 'video',    path: '/files/system-design.mp4',    accessedAt: '2026-07-12T09:00:00Z', bookId: 'b2', bookTitle: 'Architecture' },
];

export const STUB_FAVORITES: FavoriteItem[] = [
  { id: 'f1', kind: 'book', label: 'Entropy Devlog', bookId: 'b6' },
  { id: 'f2', kind: 'book', label: 'Design Notes',   bookId: 'b1' },
];
