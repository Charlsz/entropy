import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import type { FileKind, FileRef } from '../../shared/files';
import { isValidWorkspacePath } from './workspace';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);

function resolveWorkspace(workspacePath: string): string {
  if (!isValidWorkspacePath(workspacePath)) {
    throw new Error('Workspace folder is missing or invalid.');
  }
  return path.resolve(workspacePath);
}

export function detectFileKind(filePath: string): FileKind {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXT.has(ext)) {
    return 'image';
  }
  if (ext === '.pdf') {
    return 'pdf';
  }
  if (VIDEO_EXT.has(ext)) {
    return 'video';
  }
  if (AUDIO_EXT.has(ext)) {
    return 'audio';
  }
  return 'other';
}

function isInsideDirectory(parentDir: string, candidatePath: string): boolean {
  const relative = path.relative(parentDir, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toPosixRelative(from: string, to: string): string {
  const rel = path.relative(from, to).split(path.sep).join('/');
  if (!rel || rel === '') {
    return './';
  }
  return rel.startsWith('.') ? rel : `./${rel}`;
}

export function buildFileRef(workspacePath: string, absolutePath: string): FileRef {
  const root = resolveWorkspace(workspacePath);
  const resolved = path.resolve(absolutePath);
  const exists = fs.existsSync(resolved) && fs.statSync(resolved).isFile();
  const name = path.basename(resolved);
  const inside = isInsideDirectory(root, resolved);

  const href = inside ? toPosixRelative(root, resolved) : pathToFileURL(resolved).href;

  return {
    path: resolved,
    name,
    href,
    kind: detectFileKind(resolved),
    exists,
    isInsideWorkspace: inside
  };
}

export function resolveHref(workspacePath: string, href: string): FileRef {
  const root = resolveWorkspace(workspacePath);
  const trimmed = href.trim();

  if (!trimmed) {
    throw new Error('Empty file reference.');
  }

  let absolute: string;

  if (trimmed.startsWith('file:')) {
    absolute = fileURLToPath(trimmed);
  } else if (path.isAbsolute(trimmed)) {
    absolute = trimmed;
  } else {
    absolute = path.resolve(root, trimmed);
  }

  return buildFileRef(root, absolute);
}

export function formatMarkdownLink(ref: FileRef, label?: string): string {
  const text = label?.trim() || ref.name;
  return `[${text}](${ref.href})`;
}
