import fs from 'node:fs';
import path from 'node:path';
import type { CreatePageInput, Page, PageSummary, WritePageInput } from '../../shared/pages';
import { isValidWorkspacePath } from './workspace';

const PAGES_DIR = 'pages';

function ensurePagesDir(workspacePath: string): string {
  const pagesPath = path.join(workspacePath, PAGES_DIR);
  if (!fs.existsSync(pagesPath)) {
    fs.mkdirSync(pagesPath, { recursive: true });
  }
  return pagesPath;
}

function resolveWorkspace(workspacePath: string): string {
  if (!isValidWorkspacePath(workspacePath)) {
    throw new Error('Workspace folder is missing or invalid.');
  }
  return path.resolve(workspacePath);
}

function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'untitled';
}

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.md$/i, '');
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Untitled';
}

function extractTitle(content: string, fallback: string): string {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const heading = trimmed.match(/^#\s+(.+)$/);
    if (heading?.[1]) {
      return heading[1].trim();
    }
    return fallback;
  }
  return fallback;
}

function uniqueFileName(pagesPath: string, baseSlug: string): string {
  let candidate = `${baseSlug}.md`;
  let counter = 2;

  while (fs.existsSync(path.join(pagesPath, candidate))) {
    candidate = `${baseSlug}-${counter}.md`;
    counter += 1;
  }

  return candidate;
}

function assertSafePageId(pageId: string): string {
  if (!pageId || pageId.includes('..') || pageId.includes('/') || pageId.includes('\\')) {
    throw new Error('Invalid page id.');
  }

  if (!pageId.toLowerCase().endsWith('.md')) {
    throw new Error('Page id must be a Markdown file.');
  }

  return pageId;
}

function isInsideDirectory(parentDir: string, candidatePath: string): boolean {
  const relative = path.relative(parentDir, candidatePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function pagePath(workspacePath: string, pageId: string): string {
  const safeId = assertSafePageId(pageId);
  const pagesPath = ensurePagesDir(workspacePath);
  const fullPath = path.join(pagesPath, safeId);
  const resolvedPages = path.resolve(pagesPath);
  const resolvedFile = path.resolve(fullPath);

  if (!isInsideDirectory(resolvedPages, resolvedFile)) {
    throw new Error('Page path escapes the workspace.');
  }

  return resolvedFile;
}

function toSummary(workspacePath: string, fileName: string): PageSummary {
  const fullPath = pagePath(workspacePath, fileName);
  const stat = fs.statSync(fullPath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const fallback = titleFromFileName(fileName);

  return {
    id: fileName,
    title: extractTitle(content, fallback),
    fileName,
    relativePath: path.join(PAGES_DIR, fileName).replace(/\\/g, '/'),
    updatedAt: stat.mtime.toISOString()
  };
}

function toPage(workspacePath: string, fileName: string): Page {
  const fullPath = pagePath(workspacePath, fileName);
  const content = fs.readFileSync(fullPath, 'utf8');
  const summary = toSummary(workspacePath, fileName);

  return {
    ...summary,
    content
  };
}

export function listPages(workspacePath: string): PageSummary[] {
  const root = resolveWorkspace(workspacePath);
  const pagesPath = ensurePagesDir(root);

  const files = fs
    .readdirSync(pagesPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name);

  return files
    .map((fileName) => toSummary(root, fileName))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createPage(workspacePath: string, input: CreatePageInput = {}): Page {
  const root = resolveWorkspace(workspacePath);
  const pagesPath = ensurePagesDir(root);
  const title = (input.title?.trim() || 'Untitled').slice(0, 120);
  const fileName = uniqueFileName(pagesPath, slugify(title));
  const content = `# ${title}\n\n`;
  const fullPath = path.join(pagesPath, fileName);

  fs.writeFileSync(fullPath, content, 'utf8');
  return toPage(root, fileName);
}

export function readPage(workspacePath: string, pageId: string): Page {
  const root = resolveWorkspace(workspacePath);
  const fullPath = pagePath(root, pageId);

  if (!fs.existsSync(fullPath)) {
    throw new Error('Page not found.');
  }

  return toPage(root, pageId);
}

export function writePage(workspacePath: string, pageId: string, input: WritePageInput): Page {
  const root = resolveWorkspace(workspacePath);
  const fullPath = pagePath(root, pageId);

  if (!fs.existsSync(fullPath)) {
    throw new Error('Page not found.');
  }

  let content = input.content;
  if (typeof input.title === 'string' && input.title.trim()) {
    content = upsertTitleHeading(content, input.title.trim());
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  return toPage(root, pageId);
}

export function renamePage(workspacePath: string, pageId: string, title: string): Page {
  const root = resolveWorkspace(workspacePath);
  const currentPath = pagePath(root, pageId);

  if (!fs.existsSync(currentPath)) {
    throw new Error('Page not found.');
  }

  const nextTitle = title.trim().slice(0, 120) || 'Untitled';
  const pagesPath = ensurePagesDir(root);
  const slug = slugify(nextTitle);
  const desiredName = `${slug}.md`;
  let nextFileName = pageId;

  if (desiredName !== pageId) {
    nextFileName = fs.existsSync(path.join(pagesPath, desiredName))
      ? uniqueFileName(pagesPath, slug)
      : desiredName;
  }

  const current = fs.readFileSync(currentPath, 'utf8');
  const updated = upsertTitleHeading(current, nextTitle);

  if (nextFileName === pageId) {
    fs.writeFileSync(currentPath, updated, 'utf8');
    return toPage(root, pageId);
  }

  const nextPath = path.join(pagesPath, nextFileName);
  fs.writeFileSync(nextPath, updated, 'utf8');
  fs.unlinkSync(currentPath);
  return toPage(root, nextFileName);
}

export function deletePage(workspacePath: string, pageId: string): void {
  const root = resolveWorkspace(workspacePath);
  const fullPath = pagePath(root, pageId);

  if (!fs.existsSync(fullPath)) {
    throw new Error('Page not found.');
  }

  fs.unlinkSync(fullPath);
}

function upsertTitleHeading(content: string, title: string): string {
  const lines = content.split(/\r?\n/);
  const headingLine = `# ${title}`;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }

    if (line.trim()) {
      if (/^#\s+/.test(line.trim())) {
        lines[i] = headingLine;
        return lines.join('\n');
      }
      break;
    }
  }

  if (!content.trim()) {
    return `${headingLine}\n\n`;
  }

  return `${headingLine}\n\n${content}`;
}
