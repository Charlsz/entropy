import { FileText, Paperclip } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FileRef } from '../../shared/files';
import type { Page } from '../../shared/pages';
import { extractFileLinks, formatFileMarkdownLink, insertAtCursor } from '../lib/markdown-files';
import Button from './ui/button';
import LinkedFiles from './LinkedFiles';

interface PageEditorProps {
  workspacePath: string;
  page: Page | null;
  title: string;
  content: string;
  saving: boolean;
  dirty: boolean;
  onTitleChange: (title: string) => void;
  onTitleBlur: (title: string) => void;
  onContentChange: (content: string) => void;
  onError: (message: string | null) => void;
}

export default function PageEditor({
  workspacePath,
  page,
  title,
  content,
  saving,
  dirty,
  onTitleChange,
  onTitleBlur,
  onContentChange,
  onError
}: PageEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [linkedFiles, setLinkedFiles] = useState<FileRef[]>([]);
  const linkHrefs = useMemo(
    () => extractFileLinks(content).map((link) => link.href),
    [content]
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveLinks() {
      if (linkHrefs.length === 0) {
        setLinkedFiles([]);
        return;
      }

      const unique = [...new Set(linkHrefs)];
      const resolved: FileRef[] = [];

      for (const href of unique) {
        const result = await window.entropy.resolveFileRef(workspacePath, href);
        if (result.ok) {
          resolved.push(result.data);
        }
      }

      if (!cancelled) {
        setLinkedFiles(resolved);
      }
    }

    void resolveLinks();

    return () => {
      cancelled = true;
    };
  }, [linkHrefs, workspacePath]);

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

  async function linkFile() {
    onError(null);
    const result = await window.entropy.pickFile(workspacePath);
    if (!result.ok) {
      onError(result.error);
      return;
    }

    if (!result.data) {
      return;
    }

    const markdown = formatFileMarkdownLink(result.data.name, result.data.href);
    const cursor = textareaRef.current?.selectionStart ?? content.length;
    const { next, cursor: nextCursor } = insertAtCursor(content, markdown, cursor);
    onContentChange(next);

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) {
        return;
      }
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function openLinkedFile(file: FileRef) {
    onError(null);
    if (!file.exists) {
      onError(`Missing file: ${file.path}`);
      return;
    }

    const result = await window.entropy.openFile(file.path);
    if (!result.ok) {
      onError(result.error);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-entropy-border px-5 py-3">
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={(event) => onTitleBlur(event.target.value)}
          className="w-full bg-transparent text-xl font-semibold tracking-[-0.03em] text-entropy-text outline-none placeholder:text-entropy-muted"
          placeholder="Untitled"
          spellCheck
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            className="min-h-9 px-3 py-2 text-xs"
            onClick={() => void linkFile()}
            title="Link a local file"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Link file
          </Button>
          <span className="text-xs text-entropy-muted">
            {saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
          </span>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 font-mono text-sm leading-7 text-entropy-text outline-none placeholder:text-entropy-muted"
        placeholder="Write in Markdown… link ideas, drop thoughts, keep context with your files."
        spellCheck
      />

      <LinkedFiles files={linkedFiles} onOpen={(file) => void openLinkedFile(file)} />
    </div>
  );
}
