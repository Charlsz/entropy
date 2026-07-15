import React from 'react';

/**
 * Card primitive.
 *
 * A surface with consistent padding, border, and optional hover state.
 * Use `interactive` when the card is clickable (adds cursor and hover bg).
 *
 * Why no shadow by default?
 * Dark UIs rarely benefit from drop shadows. Borders communicate elevation better.
 */

interface CardProps {
  children: React.ReactNode;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, interactive = false, className = '', onClick }: CardProps) {
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive && onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={[
        'rounded-lg border border-surface-border bg-surface p-4',
        interactive
          ? 'cursor-pointer transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
          : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
