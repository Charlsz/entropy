import React from 'react';
import {
  Sidebar,
  SidebarSection,
  SidebarItem,
  Input,
  Divider,
} from '../design-system';

export type LibrarySection = 'all' | 'recent' | 'favorites';

interface Props {
  active: LibrarySection;
  onSelect: (s: LibrarySection) => void;
  query: string;
  onQuery: (q: string) => void;
}

export function LibrarySidebar({ active, onSelect, query, onQuery }: Props) {
  return (
    <Sidebar>
      <SidebarSection>
        <Input
          placeholder="Search library…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          icon={
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
      </SidebarSection>

      <SidebarSection label="Browse">
        <SidebarItem label="All Books" active={active === 'all'}     onClick={() => onSelect('all')} />
        <SidebarItem label="Recent"    active={active === 'recent'}  onClick={() => onSelect('recent')} />
        <SidebarItem label="Favorites" active={active === 'favorites'} onClick={() => onSelect('favorites')} />
      </SidebarSection>

      <Divider />

      <SidebarSection label="Quick access">
        <p className="px-2 text-xs text-text-muted leading-relaxed">
          Drag a book here to pin it.
        </p>
      </SidebarSection>
    </Sidebar>
  );
}
