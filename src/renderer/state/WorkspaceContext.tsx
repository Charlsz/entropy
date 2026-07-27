import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SectionId } from "../components/Sidebar";
import {
  createWorkspaceState,
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
  closeWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  path: string;
  onClose: () => void;
  children: ReactNode;
}

export function WorkspaceProvider({ path, onClose, children }: WorkspaceProviderProps) {
  const [workspace, setWorkspace] = useState(() => createWorkspaceState(path));

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

  const updateSettings = useCallback((patch: Partial<WorkspaceSettings>) => {
    setWorkspace((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const value = useMemo(
    () => ({
      workspace,
      setSection,
      setCurrentFolder,
      addRecentFile,
      clearRecentFiles,
      updateSettings,
      closeWorkspace: onClose,
    }),
    [
      workspace,
      setSection,
      setCurrentFolder,
      addRecentFile,
      clearRecentFiles,
      updateSettings,
      onClose,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export { WorkspaceContext };
export type { WorkspaceContextValue };
