import React from 'react';

/**
 * AppShell — the top-level layout.
 *
 * Architecture:
 *   ┌────────────────────────────────────────┐
 *   │  Titlebar (drag region + window ctrl)  │
 *   ├──────────┬─────────────────────────────┤
 *   │          │                             │
 *   │ Sidebar  │       Main content          │
 *   │          │                             │
 *   └──────────┴─────────────────────────────┘
 *
 * Why not a CSS grid for the outer shell?
 * Flex is simpler and sufficient here. Grid shines when we have a third
 * panel (inspector) — we add it then.
 *
 * The titlebar uses `-webkit-app-region: drag` via the `app-drag` class
 * defined in global CSS. Buttons inside use `app-no-drag`.
 */

interface AppShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-text-primary">
      {/* Titlebar */}
      <div className="app-drag flex h-9 w-full shrink-0 items-center border-b border-surface-border bg-surface px-3">
        {/* Traffic lights on macOS sit here automatically via Electron frameless config */}
        <span className="ml-16 select-none text-xs text-text-muted">Entropy</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {sidebar}
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
