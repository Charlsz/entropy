import React from 'react';

/**
 * Input primitive.
 *
 * Wraps a native <input> with consistent styling.
 * An optional leading icon slot is supported via the `icon` prop
 * so callers can pass a React node without coupling the Input to any icon library.
 *
 * Why not a full form library?
 * We're building a foundation. Form state management belongs in feature code.
 */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

export function Input({ icon, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-2.5 text-text-muted">
            {icon}
          </span>
        )}
        <input
          className={[
            'h-8 w-full rounded border bg-surface-elevated text-sm text-text-primary placeholder:text-text-muted',
            'border-surface-border focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40',
            'transition-colors',
            icon ? 'pl-8 pr-3' : 'px-3',
            error ? 'border-danger/60 focus:border-danger focus:ring-danger/30' : '',
            className,
          ].join(' ')}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
