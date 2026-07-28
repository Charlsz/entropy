import type { SectionId } from "../types/section";

export interface WorkspaceSettings {
  theme: "dark" | "light";
  sidebarCollapsed: boolean;
  filesView: "list" | "grid";
}

export interface WorkspaceState {
  path: string;
  name: string;
  currentFolder: string;
  currentSection: SectionId;
  recentFiles: string[];
  settings: WorkspaceSettings;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  theme: "dark",
  sidebarCollapsed: false,
  filesView: "grid",
};

export function createWorkspaceState(workspacePath: string): WorkspaceState {
  const normalized = workspacePath.replace(/[/\\]+$/, "");
  const name = normalized.split(/[/\\]/).pop() || "Workspace";

  return {
    path: normalized,
    name,
    currentFolder: normalized,
    currentSection: "notebook",
    recentFiles: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
