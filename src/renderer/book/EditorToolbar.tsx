import React from 'react';

/**
 * EditorToolbar — a minimal sticky formatting bar.
 *
 * Buttons are visual only at this stage — actions wired when the rich
 * editor is integrated. The toolbar intentionally has very low visual weight;
 * it should not compete with the content.
 */

const TOOLS = [
  { label: 'B',  title: 'Bold',          className: 'font-bold' },
  { label: 'I',  title: 'Italic',         className: 'italic' },
  { label: 'H',  title: 'Heading',        className: '' },
  { label: '“”', title: 'Blockquote',    className: '' },
  { label: '═',  title: 'Code block',    className: 'font-mono' },
  { label: '―',  title: 'Divider',       className: '' },
  { label: '🔗', title: 'Link',          className: '' },
  { label: '🖼️', title: 'Insert file', className: '' },
];

export function EditorToolbar() {
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-surface-border bg-surface px-4">
      {TOOLS.map((tool, i) => (
        <React.Fragment key={tool.title}>
          {(i === 6 || i === 7) && i !== 0 && (
            <div className="mx-1 h-4 w-px bg-surface-border" />
          )}
          <button
            title={tool.title}
            className={[
              'flex h-6 w-7 items-center justify-center rounded text-xs text-text-muted',
              'hover:bg-surface-elevated hover:text-text-secondary transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40',
              tool.className,
            ].join(' ')}
          >
            {tool.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
