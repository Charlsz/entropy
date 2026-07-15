import { Chapter } from './types';

export const STUB_CHAPTERS: Chapter[] = [
  {
    id: 'c1',
    title: 'Foundation',
    pages: [
      {
        id: 'p1',
        title: 'Why Entropy',
        content: `# Why Entropy\n\nThe name comes from the tendency of systems to drift toward disorder.\nEntropy is the notebook that holds the chaos together.\n\n## Philosophy\n\nSoftware should respect the user\'s attention.\nFiles belong to the user, not the application.\n`,
        files: [],
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-14T20:00:00Z',
      },
      {
        id: 'p2',
        title: 'Design Principles',
        content: `# Design Principles\n\nCalm. Local. Fast.\n\nEvery decision in the interface should reduce cognitive load, not add to it.\n`,
        files: [],
        createdAt: '2026-07-02T00:00:00Z',
        updatedAt: '2026-07-13T10:00:00Z',
      },
    ],
  },
  {
    id: 'c2',
    title: 'Architecture',
    pages: [
      {
        id: 'p3',
        title: 'Folder Structure',
        content: `# Folder Structure\n\nEach folder exists for a reason.\nNo folder is created speculatively.\n`,
        files: [],
        createdAt: '2026-07-03T00:00:00Z',
        updatedAt: '2026-07-12T09:00:00Z',
      },
    ],
  },
];
