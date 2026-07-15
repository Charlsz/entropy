import { useCallback, useEffect, useRef, useState } from 'react';
import type { Page, PageSummary } from '../../shared/pages';
import type { WorkspaceSelection } from '../../shared/workspace';

const AUTOSAVE_MS = 500;

export function usePages(workspace: WorkspaceSelection) {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [activePage, setActivePage] = useState<Page | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const draftContentRef = useRef('');
  const draftTitleRef = useRef('');

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    draftContentRef.current = draftContent;
  }, [draftContent]);

  useEffect(() => {
    draftTitleRef.current = draftTitle;
  }, [draftTitle]);

  const refreshList = useCallback(async () => {
    const result = await window.entropy.listPages(workspace.path);
    if (!result.ok) {
      setError(result.error);
      return [];
    }
    setPages(result.data);
    return result.data;
  }, [workspace.path]);

  const openPage = useCallback(
    async (pageId: string) => {
      setError(null);
      const result = await window.entropy.readPage(workspace.path, pageId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      activeIdRef.current = result.data.id;
      setActivePage(result.data);
      setDraftContent(result.data.content);
      setDraftTitle(result.data.title);
      setDirty(false);
    },
    [workspace.path]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);

      try {
        const list = await refreshList();
        if (cancelled) {
          return;
        }

        const first = list[0];
        if (first) {
          await openPage(first.id);
        } else {
          setActivePage(null);
          setDraftContent('');
          setDraftTitle('');
          activeIdRef.current = null;
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load pages for this workspace.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [openPage, refreshList, workspace.path]);

  const flushSave = useCallback(async () => {
    const pageId = activeIdRef.current;
    if (!pageId || !dirtyRef.current) {
      return true;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await window.entropy.writePage(workspace.path, pageId, {
        content: draftContentRef.current,
        title: draftTitleRef.current
      });

      if (!result.ok) {
        setError(result.error);
        return false;
      }

      setActivePage(result.data);
      setDraftTitle(result.data.title);
      setDirty(false);
      await refreshList();
      return true;
    } catch {
      setError('Failed to save the page.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [refreshList, workspace.path]);

  useEffect(() => {
    if (!dirty || !activeIdRef.current) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      void flushSave();
    }, AUTOSAVE_MS);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [dirty, draftContent, draftTitle, flushSave]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  async function createPage(title?: string) {
    setError(null);

    if (dirtyRef.current) {
      const saved = await flushSave();
      if (!saved) {
        return;
      }
    }

    const result = await window.entropy.createPage(workspace.path, title ? { title } : undefined);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    await refreshList();
    activeIdRef.current = result.data.id;
    setActivePage(result.data);
    setDraftContent(result.data.content);
    setDraftTitle(result.data.title);
    setDirty(false);
  }

  async function selectPage(pageId: string) {
    if (pageId === activeIdRef.current) {
      return;
    }

    if (dirtyRef.current) {
      const saved = await flushSave();
      if (!saved) {
        return;
      }
    }

    await openPage(pageId);
  }

  function updateContent(content: string) {
    setDraftContent(content);
    setDirty(true);
  }

  function updateTitle(title: string) {
    setDraftTitle(title);
    setDirty(true);
  }

  async function renameActivePage(title: string) {
    const pageId = activeIdRef.current;
    if (!pageId) {
      return;
    }

    if (dirtyRef.current) {
      const saved = await flushSave();
      if (!saved) {
        return;
      }
    }

    setError(null);
    const result = await window.entropy.renamePage(workspace.path, pageId, title);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    activeIdRef.current = result.data.id;
    setActivePage(result.data);
    setDraftContent(result.data.content);
    setDraftTitle(result.data.title);
    setDirty(false);
    await refreshList();
  }

  async function deleteActivePage() {
    const pageId = activeIdRef.current;
    if (!pageId) {
      return false;
    }

    setError(null);
    const result = await window.entropy.deletePage(workspace.path, pageId);
    if (!result.ok) {
      setError(result.error);
      return false;
    }

    const list = await refreshList();
    const first = list[0];
    if (first) {
      await openPage(first.id);
    } else {
      activeIdRef.current = null;
      setActivePage(null);
      setDraftContent('');
      setDraftTitle('');
      setDirty(false);
    }
    return true;
  }

  async function selectAdjacentPage(direction: 1 | -1) {
    if (pages.length === 0) {
      return;
    }

    const currentId = activeIdRef.current;
    const index = pages.findIndex((page) => page.id === currentId);
    const fallbackIndex = direction === 1 ? 0 : pages.length - 1;
    const nextIndex = index === -1 ? fallbackIndex : (index + direction + pages.length) % pages.length;
    const next = pages[nextIndex];
    if (next) {
      await selectPage(next.id);
    }
  }

  return {
    pages,
    activePage,
    draftContent,
    draftTitle,
    loading,
    saving,
    dirty,
    error,
    createPage,
    selectPage,
    selectAdjacentPage,
    updateContent,
    updateTitle,
    renameActivePage,
    deleteActivePage,
    flushSave,
    setError
  };
}
