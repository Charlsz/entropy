/**
 * createReference — factory for building a FileReference from a drop event.
 *
 * Electron exposes the real filesystem path via DataTransfer.files[n].path.
 * We build a reference object here; the caller decides where to store it.
 *
 * Note: thumbnailPath is undefined at creation time.
 * The main process generates thumbnails asynchronously and updates the reference.
 */

import { FileReference } from './types';

type FileType = FileReference['fileType'];

const EXT_MAP: Record<string, FileType> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  pdf: 'pdf',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video',
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio', ogg: 'audio',
  doc: 'document', docx: 'document', txt: 'document', md: 'document',
};

function typeFromPath(path: string): FileType {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MAP[ext] ?? 'other';
}

interface CreateRefParams {
  fileId: string;
  filePath: string;
  fileName: string;
  size: number;
  pageId: string;
  bookId: string;
}

export function createReference(params: CreateRefParams): FileReference {
  return {
    refId:          `ref_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    fileId:         params.fileId,
    filePath:       params.filePath,
    fileName:       params.fileName,
    fileType:       typeFromPath(params.filePath),
    size:           params.size,
    addedToPageAt:  new Date().toISOString(),
    annotations:    [],
    pageId:         params.pageId,
    bookId:         params.bookId,
  };
}
