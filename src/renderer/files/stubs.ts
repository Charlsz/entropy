import { FileEntry, Folder } from './types';

export const STUB_FOLDERS: Folder[] = [
  { id: 'f1', name: 'References',    parentId: null,  color: '#4a90d9' },
  { id: 'f2', name: 'Screenshots',   parentId: 'f1',  color: '#5cba8a' },
  { id: 'f3', name: 'Papers',        parentId: 'f1',  color: '#d9904a' },
  { id: 'f4', name: 'Inspiration',   parentId: null,  color: '#9a4ad9' },
];

export const STUB_FILES: FileEntry[] = [
  { id: 'e1', name: 'moodboard-v3.png',    path: '/files/moodboard-v3.png',    type: 'image',    size: 2400000, folderId: 'f1', addedAt: '2026-07-14T19:00:00Z', tags: ['design'] },
  { id: 'e2', name: 'linear-paper.pdf',    path: '/files/linear-paper.pdf',    type: 'pdf',      size: 1800000, folderId: 'f3', addedAt: '2026-07-14T15:00:00Z', tags: ['reading'] },
  { id: 'e3', name: 'reference-01.jpg',    path: '/files/reference-01.jpg',    type: 'image',    size: 980000,  folderId: 'f4', addedAt: '2026-07-13T12:00:00Z', tags: ['inspiration'] },
  { id: 'e4', name: 'system-design.mp4',   path: '/files/system-design.mp4',   type: 'video',    size: 45000000,folderId: 'f1', addedAt: '2026-07-12T09:00:00Z', tags: [] },
  { id: 'e5', name: 'color-palette.png',   path: '/files/color-palette.png',   type: 'image',    size: 540000,  folderId: 'f2', addedAt: '2026-07-11T08:00:00Z', tags: ['design'] },
  { id: 'e6', name: 'obsidian-notes.pdf',  path: '/files/obsidian-notes.pdf',  type: 'pdf',      size: 3200000, folderId: 'f3', addedAt: '2026-07-10T14:00:00Z', tags: ['reading'] },
  { id: 'e7', name: 'entropy-sketch.png',  path: '/files/entropy-sketch.png',  type: 'image',    size: 1200000, folderId: null, addedAt: '2026-07-09T10:00:00Z', tags: ['entropy'] },
  { id: 'e8', name: 'interview-rec.mp4',   path: '/files/interview-rec.mp4',   type: 'video',    size: 78000000,folderId: null, addedAt: '2026-07-08T11:00:00Z', tags: [] },
];
