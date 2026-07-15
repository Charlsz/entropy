import React from 'react';
import { FileEntry } from './types';
import { FileCard }  from './FileCard';
import { ViewMode }  from '../views/FileView';

interface Props {
  files: FileEntry[];
  mode: ViewMode;
}

export function FileGrid({ files, mode }: Props) {
  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">No files found.</p>
      </div>
    );
  }

  if (mode === 'list') {
    return (
      <div className="flex flex-col overflow-y-auto">
        {files.map((f) => (
          <FileCard key={f.id} file={f} mode="list" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 overflow-y-auto p-4">
      {files.map((f) => (
        <FileCard key={f.id} file={f} mode="grid" />
      ))}
    </div>
  );
}
