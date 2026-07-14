import { FileText } from 'lucide-react';
import type { Page } from '../../shared/pages';

interface PageEditorProps {
  page: Page | null;
  title: string;
  content: string;
  saving: boolean;
  dirty: boolean;
  onTitleChange: (title: string) => void;
  onTitleBlur: (title: string) => void;
  onContentChange: (content: string) => void;
}

export default function PageEditor({
  page,
  title,
  content,
  saving,
  dirty,
  onTitleChange,
  onTitleBlur,
  onContentChange
}: PageEditorProps) {
  if (!page) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <FileText className="mb-4 h-10 w-10 text-entropy-muted" />
        <p className="text-2xl font-medium tracking-[-0.03em] text-entropy-text">No note selected</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-entropy-muted">
          Create a page from the sidebar. Notes are plain Markdown files stored in your workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-entropy-border px-5 py-3">
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={(event) => onTitleBlur(event.target.value)}
          className="w-full bg-transparent text-xl font-semibold tracking-[-0.03em] text-entropy-text outline-none placeholder:text-entropy-muted"
          placeholder="Untitled"
          spellCheck
        />
        <span className="shrink-0 text-xs text-entropy-muted">
          {saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
        </span>
      </div>

      <textarea
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 font-mono text-sm leading-7 text-entropy-text outline-none placeholder:text-entropy-muted"
        placeholder="Write in Markdown… link ideas, drop thoughts, keep context with your files."
        spellCheck
      />
    </div>
  );
}
