import React from 'react';
import { FileEntry, FileType } from './types';
import { ViewMode } from '../views/FileView';
import { Caption } from '../design-system';

const TYPE_COLOR: Record<FileType, string> = {
  image:    '#1a2a1a',
  pdf:      '#2a1a1a',
  video:    '#1a1a2a',
  audio:    '#2a2a1a',
  document: '#1a2a2a',
  other:    '#1a1a1a',
};

const TYPE_LABEL: Record<FileType, string> = {
  image: 'IMG', pdf: 'PDF', video: 'VID',
  audio: 'AUD', document: 'DOC', other: 'FILE',
};

function formatSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface Props {
  file: FileEntry;
  mode: ViewMode;
}

export function FileCard({ file, mode }: Props) {
  if (mode === 'list') {
    return (
      <div className="flex items-center gap-3 border-b border-surface-border px-4 py-2.5 hover:bg-surface-elevated cursor-default transition-colors">
        <span
          className="flex h-7 w-10 shrink-0 items-center justify-center rounded text-xs font-bold text-text-muted"
          style={{ backgroundColor: TYPE_COLOR[file.type] }}
        >
          {TYPE_LABEL[file.type]}
        </span>
        <span className="flex-1 truncate text-sm text-text-primary">{file.name}</span>
        <Caption className="w-16 text-right">{formatSize(file.size)}</Caption>
      </div>
    );
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-surface-border bg-surface hover:border-accent/30 transition-colors cursor-default">
      {/* Preview area */}
      <div
        className="flex h-32 w-full items-center justify-center"
        style={{ backgroundColor: TYPE_COLOR[file.type] }}
      >
        {file.thumbnailPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.thumbnailPath}
            alt={file.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-2xl font-bold text-text-muted opacity-40">
            {TYPE_LABEL[file.type]}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-0.5 p-2.5">
        <span className="truncate text-xs text-text-primary leading-tight">{file.name}</span>
        <Caption>{formatSize(file.size)}</Caption>
      </div>
    </div>
  );
}
