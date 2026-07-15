import { ExternalLink, File, FileImage, FileText, Film, Music } from 'lucide-react';
import { useEffect, useState } from 'react';
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

function LinkedFileCard({ file, onOpen }: { file: FileRef; onOpen: (file: FileRef) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const Icon = kindIcon(file.kind);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (file.kind !== 'image' || !file.exists) {
        setPreview(null);
        return;
      }

      const result = await window.entropy.getImagePreview(file.path);
      if (cancelled) {
        return;
      }

      if (result.ok) {
        setPreview(result.data);
      } else {
        setPreview(null);
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [file.exists, file.kind, file.path]);

  return (
    <button
      type="button"
      onClick={() => onOpen(file)}
      title={file.path}
      className={[
        'group flex max-w-[220px] flex-col overflow-hidden rounded-xl border text-left transition-colors',
        file.exists
          ? 'border-entropy-border bg-entropy-background/40 hover:border-entropy-borderStrong hover:bg-entropy-panelSoft'
          : 'border-red-500/30 bg-red-500/10'
      ].join(' ')}
    >
      {preview ? (
        <div className="relative h-28 w-full overflow-hidden bg-black/20">
          <img src={preview} alt={file.name} className="h-full w-full object-cover" draggable={false} />
        </div>
      ) : (
        <div className="flex h-16 items-center justify-center bg-entropy-background/30">
          <Icon className="h-6 w-6 text-entropy-muted" />
        </div>
      )}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-xs text-entropy-text">{file.name}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
      </div>
      {!file.exists ? (
        <span className="px-2.5 pb-2 text-[10px] text-red-200">Missing on disk</span>
      ) : file.kind === 'pdf' ? (
        <span className="px-2.5 pb-2 text-[10px] text-entropy-muted">PDF · open externally</span>
      ) : null}
    </button>
  );
}

export default function LinkedFiles({ files, onOpen }: LinkedFilesProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-entropy-border px-4 py-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-entropy-muted">
        References
      </p>
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <LinkedFileCard key={`${file.path}-${file.href}`} file={file} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
