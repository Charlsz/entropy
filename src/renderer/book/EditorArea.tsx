import React, { useRef } from 'react';
import { Page } from './types';
import { EditorToolbar }  from './EditorToolbar';
import { useReferences }  from '../references/useReferences';
import { createReference } from '../references/createReference';
import { EmbeddedFiles }  from './EmbeddedFiles';

interface Props {
  page: Page | null;
  content: string;
  onChange: (content: string) => void;
  bookId?: string;
}

/**
 * EditorArea — writing surface with drop-to-reference support.
 *
 * Drop handling:
 *   1. dragover: prevent default to allow drop
 *   2. drop: read file path from DataTransfer (Electron exposes real paths)
 *   3. createReference() builds the ref object
 *   4. useReferences().add() stores it
 *   5. A markdown embed tag is appended to the content
 *
 * The embed tag format is: ![[filename]] — same as Obsidian for familiarity.
 */
export function EditorArea({ page, content, onChange, bookId = 'unknown' }: Props) {
  const { refs, add, remove } = useReferences(page?.id ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link'; // signal: we’re linking, not copying
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!page) return;

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      // Electron exposes the real FS path on the File object
      const filePath = (file as File & { path?: string }).path ?? file.name;
      const ref = createReference({
        fileId:   `file_${filePath}`,
        filePath,
        fileName: file.name,
        size:     file.size,
        pageId:   page.id,
        bookId,
      });
      add(ref);
      // Insert embed tag at end of content
      onChange(content + `\n\n![[${file.name}]]`);
    }
  }

  if (!page) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Select a page to start writing.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <EditorToolbar />

      <div
        className="flex-1 overflow-y-auto"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="mx-auto w-full max-w-[680px] px-12 py-12">
          <h1
            className="mb-8 w-full bg-transparent text-3xl font-semibold tracking-tight text-text-primary outline-none"
            contentEditable
            suppressContentEditableWarning
          >
            {page.title}
          </h1>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="w-full resize-none bg-transparent font-mono text-sm leading-[1.75] text-text-primary outline-none placeholder:text-text-muted min-h-[calc(100vh-280px)]"
            placeholder="Start writing in Markdown… Drop files to embed references."
            spellCheck
          />

          {refs.length > 0 && (
            <EmbeddedFiles refs={refs} onRemove={remove} />
          )}
        </div>
      </div>
    </div>
  );
}
