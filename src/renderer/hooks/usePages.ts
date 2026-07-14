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
    if (!pageId || !dirty) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await window.entropy.writePage(workspace.path, pageId, {
        content: draftContent,
        title: draftTitle
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setActivePage(result.data);
      setDraftTitle(result.data.title);
      setDirty(false);
      await refreshList();
    } catch {
      setError('Failed to save the page.');
    } finally {
      setSaving(false);
    }
  }, [dirty, draftContent, draftTitle, refreshList, workspace.path]);

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

  async function createPage(title?: string) {
    setError(null);

    if (dirty) {
      await flushSave();
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

    if (dirty) {
      await flushSave();
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
      return;
    }

    setError(null);
    const result = await window.entropy.deletePage(workspace.path, pageId);
    if (!result.ok) {
      setError(result.error);
      return;
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
    updateContent,
    updateTitle,
    renameActivePage,
    deleteActivePage,
    flushSave,
    setError
  };
}
