import React from 'react';
import { RecentFile } from './types';

const TYPE_LABELS: Record<RecentFile['type'], string> = {
  image: 'Image', pdf: 'PDF', video: 'Video',
  audio: 'Audio', document: 'Document', other: 'File',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return `${days}d ago`;
}

export function RecentList({ files }: { files: RecentFile[] }) {
  if (files.length === 0) {
    return <p className="text-sm text-text-muted">No recent files.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {files.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface-elevated cursor-default transition-colors"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted w-16 shrink-0">
            {TYPE_LABELS[f.type]}
          </span>
          <span className="flex-1 truncate text-sm text-text-primary">{f.name}</span>
          {f.bookTitle && (
            <span className="text-xs text-text-muted shrink-0">{f.bookTitle}</span>
          )}
          <span className="text-xs text-text-muted shrink-0 w-14 text-right">
            {relativeTime(f.accessedAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
