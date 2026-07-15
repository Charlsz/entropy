import fs from 'node:fs';
import path from 'node:path';
import type { SearchHit, SearchQuery } from '../../shared/search';
import { listPages } from './pages';
import { isValidWorkspacePath } from './workspace';

function buildSnippet(content: string, query: string, index: number): string {
  const radius = 48;
  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + query.length + radius);
  let snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();

  if (start > 0) {
    snippet = `…${snippet}`;
  }
  if (end < content.length) {
    snippet = `${snippet}…`;
  }

  return snippet || content.slice(0, 96).replace(/\s+/g, ' ').trim();
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let from = 0;
  while (from < haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) {
      break;
    }
    count += 1;
    from = index + needle.length;
  }
  return count;
}

export function searchPages(workspacePath: string, input: SearchQuery): SearchHit[] {
  if (!isValidWorkspacePath(workspacePath)) {
    throw new Error('Workspace folder is missing or invalid.');
  }

  const query = input.query.trim();
  if (!query) {
    return [];
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const needle = query.toLowerCase();
  const pages = listPages(workspacePath);
  const hits: SearchHit[] = [];

  for (const page of pages) {
    const fullPath = path.join(workspacePath, 'pages', page.id);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const haystack = content.toLowerCase();
    const titleHay = page.title.toLowerCase();
    const fileHay = page.fileName.toLowerCase();

    const titleMatch = titleHay.includes(needle);
    const fileMatch = fileHay.includes(needle);
    const contentIndex = haystack.indexOf(needle);
    const contentMatch = contentIndex !== -1;

    if (!titleMatch && !fileMatch && !contentMatch) {
      continue;
    }

    const matchCount =
      countOccurrences(titleHay, needle) +
      countOccurrences(fileHay, needle) +
      countOccurrences(haystack, needle);

    hits.push({
      pageId: page.id,
      title: page.title,
      fileName: page.fileName,
      snippet: contentMatch
        ? buildSnippet(content, query, contentIndex)
        : titleMatch
          ? page.title
          : page.fileName,
      matchCount
    });
  }

  return hits
    .sort((a, b) => b.matchCount - a.matchCount || a.title.localeCompare(b.title))
    .slice(0, limit);
}
