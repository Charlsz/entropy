import React from 'react';
import { Page } from './types';
import { EditorToolbar } from './EditorToolbar';

interface Props {
  page: Page | null;
  content: string;
  onChange: (content: string) => void;
}

/**
 * EditorArea — the main writing surface.
 *
 * Layout:
 *   Full height flex column
 *   ├─ EditorToolbar  (minimal, sticky top)
 *   └─ Scrollable writing surface
 *       └─ Max-width 680px centered column
 *           ├─ Page title (h1, editable)
 *           └─ Textarea (Markdown body)
 *
 * The textarea is a placeholder for a real rich editor.
 * The surrounding layout will NOT change when the editor is swapped.
 *
 * Why 680px max-width?
 * Optimal reading line length is 65–75 characters at 15px.
 * 680px achieves that at standard viewport widths.
 */
export function EditorArea({ page, content, onChange }: Props) {
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

      {/* Writing surface */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[680px] px-12 py-12">
          {/* Page title */}
          <h1
            className="mb-8 w-full bg-transparent text-3xl font-semibold tracking-tight text-text-primary outline-none"
            contentEditable
            suppressContentEditableWarning
          >
            {page.title}
          </h1>

          {/* Markdown body — textarea until rich editor is wired */}
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className={[
              'w-full resize-none bg-transparent font-mono text-sm leading-[1.75] text-text-primary',
              'outline-none placeholder:text-text-muted',
              'min-h-[calc(100vh-280px)]',
            ].join(' ')}
            placeholder="Start writing in Markdown…"
            spellCheck
          />
        </div>
      </div>
    </div>
  );
}
