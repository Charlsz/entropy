import React from 'react';

/**
 * Panel primitive.
 *
 * A panel is a subdivided surface — think an inspector or a detail pane.
 * It has a header, optional title, and a scrollable content area.
 *
 * Why separate from Card?
 * Cards are content containers that live inside panels.
 * Panels are structural; cards are content.
 */

interface PanelProps {
  title?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
}

export function Panel({
  title,
  headerRight,
  children,
  className = '',
  scrollable = true,
}: PanelProps) {
  return (
    <div
      className={`flex flex-col rounded-lg border border-surface-border bg-surface ${className}`}
    >
      {(title || headerRight) && (
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-2.5">
          {title && (
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
              {title}
            </span>
          )}
          {headerRight && <div className="flex items-center gap-1.5">{headerRight}</div>}
        </div>
      )}
      <div className={['flex-1 p-4', scrollable ? 'overflow-y-auto' : ''].join(' ')}>
        {children}
      </div>
    </div>
  );
}
