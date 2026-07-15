import React from 'react';
import { FileReference } from '../references/types';
import { Caption, Label } from '../design-system';

interface Props {
  refs: FileReference[];
  onRemove: (refId: string) => void;
}

/**
 * EmbeddedFiles — displays referenced files at the bottom of a page.
 *
 * Shows: type badge, filename, path (truncated), size, remove button.
 * No copy. No import. These are references — the file stays where it is.
 */
export function EmbeddedFiles({ refs, onRemove }: Props) {
  return (
    <div className="mt-12 border-t border-surface-border pt-6">
      <Label className="mb-3 block">Referenced files</Label>
      <div className="flex flex-col gap-2">
        {refs.map((ref) => (
          <div
            key={ref.refId}
            className="flex items-center gap-3 rounded-md border border-surface-border bg-surface px-3 py-2"
          >
            <span className="text-xs font-bold uppercase text-text-muted w-10 shrink-0">
              {ref.fileType.slice(0, 3).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs text-text-primary">{ref.fileName}</span>
              <Caption className="truncate">{ref.filePath}</Caption>
            </div>
            <button
              onClick={() => onRemove(ref.refId)}
              title="Remove reference"
              className="ml-2 text-text-muted hover:text-danger transition-colors text-xs"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
