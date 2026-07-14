import { ExternalLink, File, FileImage, FileText, Film, Music } from 'lucide-react';
import type { FileRef } from '../../shared/files';

interface LinkedFilesProps {
  files: FileRef[];
  onOpen: (file: FileRef) => void;
}

function kindIcon(kind: FileRef['kind']) {
  switch (kind) {
    case 'image':
      return FileImage;
    case 'pdf':
      return FileText;
    case 'video':
      return Film;
    case 'audio':
      return Music;
    default:
      return File;
  }
}

export default function LinkedFiles({ files, onOpen }: LinkedFilesProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-entropy-border px-4 py-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-entropy-muted">
        Linked files
      </p>
      <div className="flex flex-wrap gap-2">
        {files.map((file) => {
          const Icon = kindIcon(file.kind);
          return (
            <button
              key={`${file.path}-${file.href}`}
              type="button"
              onClick={() => onOpen(file)}
              title={file.path}
              className={[
                'inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                file.exists
                  ? 'border-entropy-border bg-entropy-background/40 text-entropy-text hover:border-entropy-borderStrong hover:bg-entropy-panelSoft'
                  : 'border-red-500/30 bg-red-500/10 text-red-200'
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="truncate">{file.name}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
