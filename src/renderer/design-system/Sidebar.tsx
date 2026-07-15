import React from 'react';

/**
 * Sidebar primitives.
 *
 * Three pieces:
 * - Sidebar: the outer container
 * - SidebarSection: a labeled group of items
 * - SidebarItem: a single navigable row
 *
 * Why three components instead of one with a config object?
 * Composition is more flexible than configuration.
 * Callers can mix sections and items freely without a schema.
 */

// ─── Sidebar ───────────────────────────────────────────────────────────────

interface SidebarProps {
  children: React.ReactNode;
  className?: string;
}

export function Sidebar({ children, className = '' }: SidebarProps) {
  return (
    <aside
      className={`flex h-full w-56 flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-surface-border bg-surface px-2 py-3 ${className}`}
    >
      {children}
    </aside>
  );
}

// ─── SidebarSection ────────────────────────────────────────────────────────

interface SidebarSectionProps {
  label?: string;
  children: React.ReactNode;
}

export function SidebarSection({ label, children }: SidebarSectionProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && (
        <span className="mb-1 px-2 text-xs font-medium uppercase tracking-widest text-text-muted">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

// ─── SidebarItem ───────────────────────────────────────────────────────────

interface SidebarItemProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  badge?: string | number;
}

export function SidebarItem({ label, icon, active = false, onClick, badge }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        active
          ? 'bg-accent-subtle font-medium text-accent'
          : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
      ].join(' ')}
    >
      {icon && <span className="size-4 shrink-0">{icon}</span>}
      <span className="flex-1 truncate text-left">{label}</span>
      {badge !== undefined && (
        <span className="rounded-full bg-surface-border px-1.5 py-0.5 text-xs text-text-muted">
          {badge}
        </span>
      )}
    </button>
  );
}
