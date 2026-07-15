import React, { useState } from 'react';
import { Chapter, Page } from './types';
import { Sidebar, SidebarSection, Divider } from '../design-system';

interface Props {
  chapters: Chapter[];
  activePage: Page | null;
  onSelectPage: (page: Page) => void;
}

/**
 * BookSidebar — two-level navigation: chapters and pages.
 *
 * Chapters are collapsible. Pages live inside them.
 * Active page is highlighted. No icons — text only, like a book's TOC.
 */
export function BookSidebar({ chapters, activePage, onSelectPage }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(chapters.map((c) => c.id)) // start with all expanded
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Sidebar className="w-52">
      <SidebarSection label="Contents">
        {chapters.map((chapter) => (
          <div key={chapter.id}>
            {/* Chapter header */}
            <button
              onClick={() => toggle(chapter.id)}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              <span
                className={`transition-transform text-text-muted ${
                  expanded.has(chapter.id) ? 'rotate-90' : ''
                }`}
              >
                ›
              </span>
              {chapter.title}
            </button>

            {/* Pages */}
            {expanded.has(chapter.id) && (
              <div className="ml-4 flex flex-col gap-0.5">
                {chapter.pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => onSelectPage(page)}
                    className={[
                      'w-full truncate rounded px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                      activePage?.id === page.id
                        ? 'bg-accent-subtle font-medium text-accent'
                        : 'text-text-muted hover:bg-surface-elevated hover:text-text-secondary',
                    ].join(' ')}
                  >
                    {page.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </SidebarSection>

      <Divider />

      <SidebarSection>
        <button className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
          <span>+</span> New page
        </button>
      </SidebarSection>
    </Sidebar>
  );
}
