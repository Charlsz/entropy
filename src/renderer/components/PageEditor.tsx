import { FileText, Paperclip, Trash2 } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import type { FileRef } from '../../shared/files';
import type { Page } from '../../shared/pages';
import { extractFileLinks, formatFileMarkdownLink, insertAtCursor } from '../lib/markdown-files';
import Button from './ui/button';
import LinkedFiles from './LinkedFiles';

export interface PageEditorHandle {
  linkFile: () => Promise<void>;
}

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
  onDeleteRequest: () => void;
  onError: (message: string | null) => void;
}

const PageEditor = forwardRef<PageEditorHandle, PageEditorProps>(function PageEditor(
  {
    workspacePath,
    page,
    title,
    content,
    saving,
    dirty,
    onTitleChange,
    onTitleBlur,
    onContentChange,
    onDeleteRequest,
    onError
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRef = useRef(content);
  const [linkedFiles, setLinkedFiles] = useState<FileRef[]>([]);
  const linkHrefs = useMemo(() => extractFileLinks(content).map((link) => link.href), [content]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

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

  async function linkFile() {
    if (!page) {
      return;
    }

    onError(null);
    const result = await window.entropy.pickFile(workspacePath);
    if (!result.ok) {
      onError(result.error);
      return;
    }

    if (!result.data) {
      return;
    }

    const current = contentRef.current;
    const markdown = formatFileMarkdownLink(result.data.name, result.data.href);
    const cursor = textareaRef.current?.selectionStart ?? current.length;
    const { next, cursor: nextCursor } = insertAtCursor(current, markdown, cursor);
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

  useImperativeHandle(ref, () => ({
    linkFile
  }));

  if (!page) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <FileText className="mb-4 h-10 w-10 text-entropy-muted" />
        <p className="text-2xl font-medium tracking-[-0.03em] text-entropy-text">Your notebook is ready</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-entropy-muted">
          Create a page to start writing. Notes stay as Markdown in this folder—open them in any editor if Entropy is
          closed.
        </p>
        <p className="mt-4 text-xs text-entropy-muted">
          Shortcut: <kbd className="rounded border border-entropy-border px-1.5 py-0.5">Ctrl/Cmd+N</kbd>
        </p>
      </div>
    );
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
            title="Link a local file (Ctrl/Cmd+L)"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Link file
          </Button>
          <Button
            variant="secondary"
            className="min-h-9 px-3 py-2 text-xs"
            onClick={onDeleteRequest}
            title="Delete page (Ctrl/Cmd+Backspace)"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
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
});

export default PageEditor;
