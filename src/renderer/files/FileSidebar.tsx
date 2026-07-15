import React from 'react';
import { Folder } from './types';
import { SortKey } from '../views/FileView';
import { Sidebar, SidebarSection, SidebarItem, Divider } from '../design-system';

const TYPE_OPTIONS = [
  { value: 'all',      label: 'All types' },
  { value: 'image',    label: 'Images' },
  { value: 'pdf',      label: 'PDFs' },
  { value: 'video',    label: 'Videos' },
  { value: 'audio',    label: 'Audio' },
  { value: 'document', label: 'Documents' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date', label: 'Date added' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'size', label: 'Size' },
];

interface Props {
  folders: Folder[];
  activeFolder: string | null;
  onSelectFolder: (id: string | null) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  typeFilter: string;
  onTypeFilter: (t: string) => void;
}

export function FileSidebar({ folders, activeFolder, onSelectFolder, sort, onSort, typeFilter, onTypeFilter }: Props) {
  const roots = folders.filter((f) => f.parentId === null);

  return (
    <Sidebar>
      <SidebarSection label="Folders">
        <SidebarItem
          label="All Files"
          active={activeFolder === null}
          onClick={() => onSelectFolder(null)}
        />
        {roots.map((folder) => (
          <SidebarItem
            key={folder.id}
            label={folder.name}
            active={activeFolder === folder.id}
            onClick={() => onSelectFolder(folder.id)}
          />
        ))}
      </SidebarSection>

      <Divider />

      <SidebarSection label="Filter">
        <div className="flex flex-col gap-1 px-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onTypeFilter(opt.value)}
              className={[
                'rounded px-2 py-1.5 text-left text-xs transition-colors',
                typeFilter === opt.value
                  ? 'bg-accent-subtle text-accent font-medium'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SidebarSection>

      <Divider />

      <SidebarSection label="Sort">
        <div className="flex flex-col gap-1 px-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSort(opt.value)}
              className={[
                'rounded px-2 py-1.5 text-left text-xs transition-colors',
                sort === opt.value
                  ? 'bg-accent-subtle text-accent font-medium'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SidebarSection>
    </Sidebar>
  );
}
