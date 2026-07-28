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
  setSection: (section: SectionId) => void;
  setCurrentFolder: (folderPath: string) => void;
  addRecentFile: (filePath: string) => void;
  clearRecentFiles: () => void;
  updateSettings: (patch: Partial<WorkspaceSettings>) => void;
  resetSettings: () => void;
  closeWorkspace: () => void;
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

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.settings.theme;
  }, [workspace.settings.theme]);

  const setSection = useCallback((section: SectionId) => {
    setWorkspace((prev) => ({ ...prev, currentSection: section }));
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
      setSection,
      setCurrentFolder,
      addRecentFile,
      clearRecentFiles,
      updateSettings,
      resetSettings,
      closeWorkspace: onClose,
    }),
    [
      workspace,
      setSection,
      setCurrentFolder,
      addRecentFile,
      clearRecentFiles,
      updateSettings,
      resetSettings,
      onClose,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export { WorkspaceContext };
export type { WorkspaceContextValue };
