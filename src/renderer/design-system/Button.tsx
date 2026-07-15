import React from 'react';

/**
 * Button primitive.
 *
 * Three variants:
 * - primary: filled accent, for the main action on a surface
 * - secondary: subtle border, for secondary actions
 * - ghost: no border, for toolbar/sidebar actions
 *
 * Two sizes: sm, md.
 * Destructive modifier turns the accent into danger color.
 *
 * Why no icon prop?
 * Callers compose icons as children. Avoids a prop API that grows forever.
 */

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  destructive?: boolean;
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-1.5 font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-40 select-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover active:brightness-90',
  secondary:
    'border border-surface-border bg-surface-elevated text-text-primary hover:bg-surface-border active:brightness-90',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-surface-elevated active:brightness-90',
};

const destructiveVariants: Record<Variant, string> = {
  primary: 'bg-danger text-white hover:brightness-110 active:brightness-90',
  secondary:
    'border border-danger/30 bg-danger-subtle text-danger hover:bg-danger/20',
  ghost: 'text-danger hover:bg-danger-subtle',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3.5 text-sm',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  destructive = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantClass = destructive ? destructiveVariants[variant] : variants[variant];

  return (
    <button
      className={[base, variantClass, sizes[size], className].join(' ')}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
