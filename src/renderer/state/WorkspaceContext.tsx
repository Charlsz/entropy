import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SectionId } from "../types/section";
import {
  createWorkspaceState,
  DEFAULT_SETTINGS,
  type WorkspaceSettings,
  type WorkspaceState,
} from "./workspace";

function samePath(a: string, b: string): boolean {
  return a.replace(/[/\\]+$/, "").toLowerCase() === b.replace(/[/\\]+$/, "").toLowerCase();
}

export type FolderNavMode = "push" | "replace";

interface WorkspaceContextValue {
  workspace: WorkspaceState;
  pendingNote: string | null;
  clearPendingNote: () => void;
  pendingReference: string | null;
  clearPendingReference: () => void;
  referenceInNote: (filePath: string) => void;
  setSection: (section: SectionId) => void;
  setCurrentFolder: (folderPath: string) => void;
  goToFolder: (
    folderPath: string,
    mode?: FolderNavMode,
    opts?: { activate?: boolean },
  ) => void;
  goBackFolder: () => void;
  goForwardFolder: () => void;
  goToInventoryCrumb: (index: number) => Promise<void>;
  setInventoryRoot: (scanRoot: string, rootLabel: string) => void;
  canGoBackFolder: boolean;
  canGoForwardFolder: boolean;
  inventoryCrumbs: string[];
  addRecentFile: (filePath: string) => void;
  clearRecentFiles: () => void;
  updateSettings: (patch: Partial<WorkspaceSettings>) => void;
  resetSettings: () => void;
  closeWorkspace: () => void;
  openNote: (notePath: string) => void;
  openFolder: (folderPath: string) => void;
  openFileLocation: (filePath: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  path: string;
  initialSettings?: WorkspaceSettings;
  onSettingsChange?: (settings: WorkspaceSettings) => void;
  onClose: () => void;
  children: ReactNode;
}

export function WorkspaceProvider({
  path,
  initialSettings,
  onSettingsChange,
  onClose,
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

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.settings.theme;
  }, [workspace.settings.theme]);

  const clearPendingNote = useCallback(() => setPendingNote(null), []);
  const clearPendingReference = useCallback(() => setPendingReference(null), []);

  const setSection = useCallback((section: SectionId) => {
    const next = (section as string) === "files" ? "inventory" : section;
    setWorkspace((prev) => ({ ...prev, currentSection: next }));
  }, []);

  const setCurrentFolder = useCallback((folderPath: string) => {
    setWorkspace((prev) => ({ ...prev, currentFolder: folderPath }));
  }, []);

  const goToFolder = useCallback(
    (folderPath: string, mode: FolderNavMode = "push", opts?: { activate?: boolean }) => {
      setWorkspace((prev) => {
        const stack = prev.folderHistory;
        const index = prev.folderHistoryIndex;
        const activate = opts?.activate ? { currentSection: "inventory" as const } : {};
        if (mode === "replace") {
          return {
            ...prev,
            ...activate,
            currentFolder: folderPath,
            folderHistory: [folderPath],
            folderHistoryIndex: 0,
          };
        }
        if (index >= 0 && samePath(stack[index] ?? "", folderPath)) {
          return { ...prev, ...activate, currentFolder: folderPath };
        }
        const nextHistory = [...stack.slice(0, index + 1), folderPath];
        return {
          ...prev,
          ...activate,
          currentFolder: folderPath,
          folderHistory: nextHistory,
          folderHistoryIndex: nextHistory.length - 1,
        };
      });
    },
    [],
  );

  const goBackFolder = useCallback(() => {
    setWorkspace((prev) => {
      if (prev.folderHistoryIndex <= 0) return prev;
      const nextIndex = prev.folderHistoryIndex - 1;
      return {
        ...prev,
        folderHistoryIndex: nextIndex,
        currentFolder: prev.folderHistory[nextIndex],
        currentSection: "inventory",
      };
    });
  }, []);

  const goForwardFolder = useCallback(() => {
    setWorkspace((prev) => {
      if (prev.folderHistoryIndex >= prev.folderHistory.length - 1) return prev;
      const nextIndex = prev.folderHistoryIndex + 1;
      return {
        ...prev,
        folderHistoryIndex: nextIndex,
        currentFolder: prev.folderHistory[nextIndex],
        currentSection: "inventory",
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
    if (!samePath(workspace.currentFolder, root) && !workspace.currentFolder.toLowerCase().startsWith(root.toLowerCase())) {
      return [];
    }
    const relative = workspace.currentFolder
      .slice(root.length)
      .replace(/^[/\\]+/, "");
    return relative ? relative.split(/[/\\]/) : [];
  }, [workspace.currentFolder, workspace.inventoryScanRoot]);

  const canGoBackFolder = workspace.folderHistoryIndex > 0;
  const canGoForwardFolder =
    workspace.folderHistoryIndex >= 0 &&
    workspace.folderHistoryIndex < workspace.folderHistory.length - 1;

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

  const openNote = useCallback(
    (notePath: string) => {
      addRecentFile(notePath);
      setSection("notebook");
      setPendingNote(notePath);
    },
    [addRecentFile, setSection],
  );

  const referenceInNote = useCallback(
    (filePath: string) => {
      addRecentFile(filePath);
      setPendingReference(filePath);
      setSection("notebook");
    },
    [addRecentFile, setSection],
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
        goToFolder(dir, "push", { activate: true });
      } catch {
        setSection("inventory");
      }
    },
    [addRecentFile, goToFolder, setSection],
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
      setCurrentFolder,
      goToFolder,
      goBackFolder,
      goForwardFolder,
      goToInventoryCrumb,
      setInventoryRoot,
      canGoBackFolder,
      canGoForwardFolder,
      inventoryCrumbs,
      addRecentFile,
      clearRecentFiles,
      updateSettings,
      resetSettings,
      closeWorkspace: onClose,
      openNote,
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
      setCurrentFolder,
      goToFolder,
      goBackFolder,
      goForwardFolder,
      goToInventoryCrumb,
      setInventoryRoot,
      canGoBackFolder,
      canGoForwardFolder,
      inventoryCrumbs,
      addRecentFile,
      clearRecentFiles,
      updateSettings,
      resetSettings,
      onClose,
      openNote,
      openFolder,
      openFileLocation,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export { WorkspaceContext };
export type { WorkspaceContextValue };
