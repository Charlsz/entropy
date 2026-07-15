/**
 * Divider — a simple horizontal or vertical rule.
 * Used for visual separation without heavy component overhead.
 */

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Divider({ orientation = 'horizontal', className = '' }: DividerProps) {
  if (orientation === 'vertical') {
    return <div className={`w-px self-stretch bg-surface-border ${className}`} />;
  }
  return <hr className={`border-t border-surface-border ${className}`} />;
}
