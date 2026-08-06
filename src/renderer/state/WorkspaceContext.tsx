import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SectionId } from "../types/section";
import {
  createWorkspaceState,
  DEFAULT_SETTINGS,
  navFolder,
  navNote,
  navPreview,
  navSection,
  type NavEntry,
  type WorkspaceSettings,
  type WorkspaceState,
} from "./workspace";
import { samePath } from "../lib/platform";

export type FolderNavMode = "push" | "replace";

interface WorkspaceContextValue {
  workspace: WorkspaceState;
  pendingNote: string | null;
  clearPendingNote: () => void;
  pendingReference: string | null;
  clearPendingReference: () => void;
  referenceInNote: (filePath: string) => void;
  setSection: (section: SectionId) => void;
  visitSection: (section: SectionId) => void;
  setCurrentFolder: (folderPath: string) => void;
  goToFolder: (
    folderPath: string,
    mode?: FolderNavMode,
    opts?: { activate?: boolean },
  ) => void;
  visitPreview: (filePath: string, folderPath?: string) => void;
  goBack: () => void;
  goForward: () => void;
  goToInventoryCrumb: (index: number) => Promise<void>;
  setInventoryRoot: (scanRoot: string, rootLabel: string) => void;
  /** Set inventory location without touching app-wide history (keep-alive bootstrap). */
  bootstrapInventoryFolder: (
    folderPath: string,
    rootLabel: string,
    scanRoot?: string,
  ) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  inventoryCrumbs: string[];
  addRecentFile: (filePath: string) => void;
  clearRecentFiles: () => void;
  updateSettings: (patch: Partial<WorkspaceSettings>) => void;
  resetSettings: () => void;
  closeWorkspace: () => void;
  /** Open a note in another workspace (flushes and remounts the session). */
  openInWorkspace: (workspacePath: string, notePath: string) => void;
  openNote: (notePath: string) => void;
  visitNote: (notePath: string) => void;
  openFolder: (folderPath: string) => void;
  openFileLocation: (filePath: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  path: string;
  initialSettings?: WorkspaceSettings;
  /** Open this note once after the workspace mounts (e.g. after switching). */
  initialNotePath?: string | null;
  onInitialNoteConsumed?: () => void;
  onSettingsChange?: (settings: WorkspaceSettings) => void;
  onClose: () => void;
  onOpenInWorkspace: (workspacePath: string, notePath: string) => void;
  children: ReactNode;
}

function applyEntry(prev: WorkspaceState, entry: NavEntry): WorkspaceState {
  return {
    ...prev,
    currentSection: entry.section,
    currentFolder: entry.folderPath ?? prev.currentFolder,
    activeNotePath:
      entry.kind === "note"
        ? entry.notePath ?? prev.activeNotePath
        : entry.section === "notebook"
          ? prev.activeNotePath
          : prev.activeNotePath,
    inventoryFocusPath:
      entry.kind === "preview"
        ? entry.previewPath ?? null
        : entry.kind === "folder"
          ? null
          : prev.inventoryFocusPath,
  };
}

function pushEntry(prev: WorkspaceState, entry: NavEntry, mode: FolderNavMode): WorkspaceState {
  // Browser-style replace: swap the current entry in place; never wipe the stack.
  if (mode === "replace") {
    if (prev.navHistory.length === 0 || prev.navHistoryIndex < 0) {
      return {
        ...applyEntry(prev, entry),
        navHistory: [entry],
        navHistoryIndex: 0,
      };
    }
    const navHistory = [...prev.navHistory];
    navHistory[prev.navHistoryIndex] = entry;
    return {
      ...applyEntry(prev, entry),
      navHistory,
      navHistoryIndex: prev.navHistoryIndex,
    };
  }
  const current = prev.navHistory[prev.navHistoryIndex];
  if (current && current.key === entry.key) {
    return applyEntry(prev, entry);
  }
  const navHistory = [...prev.navHistory.slice(0, prev.navHistoryIndex + 1), entry];
  return {
    ...applyEntry(prev, entry),
    navHistory,
    navHistoryIndex: navHistory.length - 1,
  };
}

export function WorkspaceProvider({
  path,
  initialSettings,
  initialNotePath = null,
  onInitialNoteConsumed,
  onSettingsChange,
  onClose,
  onOpenInWorkspace,
  children,
}: WorkspaceProviderProps) {
  const [workspace, setWorkspace] = useState(() => {
    const base = createWorkspaceState(path);
    return {
      ...base,
      settings: { ...DEFAULT_SETTINGS, ...initialSettings },
    };
  });

  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const restoreRef = useRef<NavEntry | null>(null);
  const consumedInitialNote = useRef(false);

  useEffect(() => {
    if (!initialNotePath || consumedInitialNote.current) return;
    consumedInitialNote.current = true;
    setPendingNote(initialNotePath);
    setWorkspace((prev) => {
      const next = pushEntry(prev, navNote(initialNotePath), "push");
      return { ...next, activeNotePath: initialNotePath };
    });
    onInitialNoteConsumed?.();
  }, [initialNotePath, onInitialNoteConsumed]);

  useEffect(() => {
    const entry = restoreRef.current;
    if (!entry) return;
    restoreRef.current = null;
    if (entry.notePath) setPendingNote(entry.notePath);
  }, [workspace.navHistoryIndex]);

  const clearPendingNote = useCallback(() => setPendingNote(null), []);
  const clearPendingReference = useCallback(() => setPendingReference(null), []);

  const setSection = useCallback((section: SectionId) => {
    const next = (section as string) === "files" ? "inventory" : section;
    setWorkspace((prev) => ({ ...prev, currentSection: next }));
  }, []);

  const visitSection = useCallback((section: SectionId) => {
    const next = (section as string) === "files" ? "inventory" : section;
    setWorkspace((prev) => {
      // Inventory: record the folder you're actually in (not always the scan root).
      if (next === "inventory") {
        const folder = prev.currentFolder || prev.inventoryScanRoot;
        if (folder) {
          const label =
            prev.inventoryScanRoot && samePath(folder, prev.inventoryScanRoot)
              ? prev.inventoryRootLabel
              : undefined;
          return pushEntry(prev, navFolder(folder, label), "push");
        }
      }
      // Notebook: restore the last note so Back/Forward bridges writing ↔ files.
      if (next === "notebook" && prev.activeNotePath) {
        return pushEntry(prev, navNote(prev.activeNotePath), "push");
      }
      return pushEntry(prev, navSection(next as SectionId), "push");
    });
  }, []);

  const setCurrentFolder = useCallback((folderPath: string) => {
    setWorkspace((prev) => ({ ...prev, currentFolder: folderPath }));
  }, []);

  const goToFolder = useCallback(
    (folderPath: string, mode: FolderNavMode = "push", opts?: { activate?: boolean }) => {
      setWorkspace((prev) => {
        const label =
          prev.inventoryScanRoot && samePath(folderPath, prev.inventoryScanRoot)
            ? prev.inventoryRootLabel
            : undefined;
        const entry = navFolder(folderPath, label);
        const next = pushEntry(prev, entry, mode);
        // Folder navigation always belongs to Inventory unless caller opts out.
        if (opts?.activate === false && prev.currentSection !== "inventory") {
          return { ...next, currentSection: prev.currentSection };
        }
        return next;
      });
    },
    [],
  );

  const visitPreview = useCallback((filePath: string, folderPath?: string) => {
    setWorkspace((prev) => {
      const folder = folderPath || prev.currentFolder;
      return pushEntry(prev, navPreview(filePath, folder), "push");
    });
  }, []);

  const goBack = useCallback(() => {
    setWorkspace((prev) => {
      if (prev.navHistoryIndex <= 0) return prev;
      const nextIndex = prev.navHistoryIndex - 1;
      const entry = prev.navHistory[nextIndex];
      restoreRef.current = entry;
      return {
        ...applyEntry(prev, entry),
        navHistoryIndex: nextIndex,
      };
    });
  }, []);

  const goForward = useCallback(() => {
    setWorkspace((prev) => {
      if (prev.navHistoryIndex >= prev.navHistory.length - 1) return prev;
      const nextIndex = prev.navHistoryIndex + 1;
      const entry = prev.navHistory[nextIndex];
      restoreRef.current = entry;
      return {
        ...applyEntry(prev, entry),
        navHistoryIndex: nextIndex,
      };
    });
  }, []);

  const setInventoryRoot = useCallback((scanRoot: string, rootLabel: string) => {
    setWorkspace((prev) => ({
      ...prev,
      inventoryScanRoot: scanRoot,
      inventoryRootLabel: rootLabel,
    }));
  }, []);

  const bootstrapInventoryFolder = useCallback(
    (folderPath: string, rootLabel: string, scanRoot?: string) => {
      setWorkspace((prev) => {
        // Keep-alive inventory mounts once; do not clobber notebook history.
        if (prev.inventoryScanRoot) {
          return {
            ...prev,
            inventoryRootLabel: rootLabel || prev.inventoryRootLabel,
          };
        }
        return {
          ...prev,
          currentFolder: folderPath,
          inventoryScanRoot: scanRoot ?? folderPath,
          inventoryRootLabel: rootLabel,
        };
      });
    },
    [],
  );

  const goToInventoryCrumb = useCallback(
    async (index: number) => {
      const root = workspace.inventoryScanRoot || workspace.currentFolder;
      if (index < 0) {
        goToFolder(root, "push", { activate: true });
        return;
      }
      const relative = workspace.currentFolder
        .slice(root.length)
        .replace(/^[/\\]+/, "");
      const parts = relative ? relative.split(/[/\\]/) : [];
      const nextParts = parts.slice(0, index + 1);
      const next = await window.entropy.fs.join(root, ...nextParts);
      goToFolder(next, "push", { activate: true });
    },
    [goToFolder, workspace.currentFolder, workspace.inventoryScanRoot],
  );

  const inventoryCrumbs = useMemo(() => {
    const root = workspace.inventoryScanRoot;
    if (!root || !workspace.currentFolder) return [];
    const folderKey = workspace.currentFolder.toLowerCase();
    const rootKey = root.toLowerCase();
    if (!samePath(workspace.currentFolder, root) && !folderKey.startsWith(rootKey)) {
      return [];
    }
    const relative = workspace.currentFolder
      .slice(root.length)
      .replace(/^[/\\]+/, "");
    return relative ? relative.split(/[/\\]/) : [];
  }, [workspace.currentFolder, workspace.inventoryScanRoot]);

  const canGoBack = workspace.navHistoryIndex > 0;
  const canGoForward =
    workspace.navHistoryIndex >= 0 &&
    workspace.navHistoryIndex < workspace.navHistory.length - 1;

  const addRecentFile = useCallback((filePath: string) => {
    setWorkspace((prev) => {
      const recentFiles = [filePath, ...prev.recentFiles.filter((item) => item !== filePath)].slice(
        0,
        20,
      );
      return { ...prev, recentFiles };
    });
  }, []);

  const clearRecentFiles = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, recentFiles: [] }));
  }, []);

  const visitNote = useCallback(
    (notePath: string) => {
      addRecentFile(notePath);
      setWorkspace((prev) => {
        const next = pushEntry(prev, navNote(notePath), "push");
        return { ...next, activeNotePath: notePath };
      });
      setPendingNote(notePath);
    },
    [addRecentFile],
  );

  const openNote = useCallback(
    (notePath: string) => {
      visitNote(notePath);
    },
    [visitNote],
  );

  const referenceInNote = useCallback(
    (filePath: string) => {
      addRecentFile(filePath);
      setPendingReference(filePath);
      visitSection("notebook");
    },
    [addRecentFile, visitSection],
  );

  const openFolder = useCallback(
    (folderPath: string) => {
      goToFolder(folderPath, "push", { activate: true });
    },
    [goToFolder],
  );

  const openFileLocation = useCallback(
    async (filePath: string) => {
      addRecentFile(filePath);
      try {
        const dir = await window.entropy.fs.dirname(filePath);
        setWorkspace((prev) => pushEntry(prev, navPreview(filePath, dir), "push"));
      } catch {
        visitSection("inventory");
      }
    },
    [addRecentFile, visitSection],
  );

  const updateSettings = useCallback(
    (patch: Partial<WorkspaceSettings>) => {
      setWorkspace((prev) => {
        const settings = { ...prev.settings, ...patch };
        onSettingsChange?.(settings);
        return { ...prev, settings };
      });
    },
    [onSettingsChange],
  );

  const resetSettings = useCallback(() => {
    setWorkspace((prev) => {
      const settings = { ...DEFAULT_SETTINGS };
      onSettingsChange?.(settings);
      return { ...prev, settings };
    });
  }, [onSettingsChange]);

  const value = useMemo(
    () => ({
      workspace,
      pendingNote,
      clearPendingNote,
      pendingReference,
      clearPendingReference,
      referenceInNote,
      setSection,
      visitSection,
      setCurrentFolder,
      goToFolder,
      visitPreview,
      goBack,
      goForward,
      goToInventoryCrumb,
      setInventoryRoot,
      bootstrapInventoryFolder,
      canGoBack,
      canGoForward,
      inventoryCrumbs,
      addRecentFile,
      clearRecentFiles,
      updateSettings,
      resetSettings,
      closeWorkspace: onClose,
      openInWorkspace: onOpenInWorkspace,
      openNote,
      visitNote,
      openFolder,
      openFileLocation,
    }),
    [
      workspace,
      pendingNote,
      clearPendingNote,
      pendingReference,
      clearPendingReference,
      referenceInNote,
      setSection,
      visitSection,
      setCurrentFolder,
      goToFolder,
      visitPreview,
      goBack,
      goForward,
      goToInventoryCrumb,
      setInventoryRoot,
      bootstrapInventoryFolder,
      canGoBack,
      canGoForward,
      inventoryCrumbs,
      addRecentFile,
      clearRecentFiles,
      updateSettings,
      resetSettings,
      onClose,
      onOpenInWorkspace,
      openNote,
      visitNote,
      openFolder,
      openFileLocation,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export { WorkspaceContext };
export type { WorkspaceContextValue };
