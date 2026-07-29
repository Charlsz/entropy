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

interface WorkspaceContextValue {
  workspace: WorkspaceState;
  pendingNote: string | null;
  clearPendingNote: () => void;
  setSection: (section: SectionId) => void;
  setCurrentFolder: (folderPath: string) => void;
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

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.settings.theme;
  }, [workspace.settings.theme]);

  const setSection = useCallback((section: SectionId) => {
    const next = (section as string) === "files" ? "inventory" : section;
    setWorkspace((prev) => ({ ...prev, currentSection: next }));
  }, []);

  const setCurrentFolder = useCallback((folderPath: string) => {
    setWorkspace((prev) => ({ ...prev, currentFolder: folderPath }));
  }, []);

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

  const clearPendingNote = useCallback(() => setPendingNote(null), []);

  const openNote = useCallback(
    (notePath: string) => {
      addRecentFile(notePath);
      setSection("notebook");
      setPendingNote(notePath);
    },
    [addRecentFile, setSection],
  );

  const openFolder = useCallback(
    (folderPath: string) => {
      setCurrentFolder(folderPath);
      setSection("inventory");
    },
    [setCurrentFolder, setSection],
  );

  const openFileLocation = useCallback(
    async (filePath: string) => {
      addRecentFile(filePath);
      try {
        const dir = await window.entropy.fs.dirname(filePath);
        setCurrentFolder(dir);
      } catch {
        // Keep current folder if dirname fails.
      }
      setSection("inventory");
    },
    [addRecentFile, setCurrentFolder, setSection],
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
      setSection,
      setCurrentFolder,
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
      setSection,
      setCurrentFolder,
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
