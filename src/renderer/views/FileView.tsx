import React, { useState, useMemo } from 'react';
import { FileSidebar }  from '../files/FileSidebar';
import { FileGrid }     from '../files/FileGrid';
import { FileToolbar }  from '../files/FileToolbar';
import { STUB_FILES, STUB_FOLDERS } from '../files/stubs';
import { FileEntry }    from '../files/types';

export type SortKey = 'name' | 'type' | 'size' | 'date';
export type ViewMode = 'grid' | 'list';

export function FileView() {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [sort,     setSort]     = useState<SortKey>('date');
  const [query,    setQuery]    = useState('');
  const [mode,     setMode]     = useState<ViewMode>('grid');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const visible: FileEntry[] = useMemo(() => {
    let files = folderId
      ? STUB_FILES.filter((f) => f.folderId === folderId)
      : STUB_FILES;

    if (typeFilter !== 'all') {
      files = files.filter((f) => f.type === typeFilter);
    }

    if (query) {
      const q = query.toLowerCase();
      files = files.filter((f) => f.name.toLowerCase().includes(q));
    }

    return [...files].sort((a, b) => {
      switch (sort) {
        case 'name': return a.name.localeCompare(b.name);
        case 'type': return a.type.localeCompare(b.type);
        case 'size': return b.size - a.size;
        case 'date': return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        default:     return 0;
      }
    });
  }, [folderId, sort, query, typeFilter]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <FileSidebar
        folders={STUB_FOLDERS}
        activeFolder={folderId}
        onSelectFolder={setFolderId}
        sort={sort}
        onSort={setSort}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <FileToolbar
          query={query}
          onQuery={setQuery}
          mode={mode}
          onMode={setMode}
          count={visible.length}
        />
        <FileGrid files={visible} mode={mode} />
      </div>
    </div>
  );
}
