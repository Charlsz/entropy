import type { Layout } from "react-resizable-panels";

export interface PanelLayoutState {
  sidebar: number;
  main: number;
  context: number;
}

export interface WorkspaceSettings {
  theme: "dark" | "light";
  sidebarCollapsed: boolean;
  contextCollapsed: boolean;
  filesView: "list" | "grid";
  panelLayout: PanelLayoutState;
}

export interface WorkspaceState {
  path: string;
  name: string;
  currentFolder: string;
  currentSection: import("../types/section").SectionId;
  recentFiles: string[];
  settings: WorkspaceSettings;
}

export const DEFAULT_PANEL_LAYOUT: PanelLayoutState = {
  sidebar: 22,
  main: 58,
  context: 20,
};

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  theme: "dark",
  sidebarCollapsed: false,
  contextCollapsed: false,
  filesView: "grid",
  panelLayout: { ...DEFAULT_PANEL_LAYOUT },
};

export function normalizePanelLayout(value: unknown): PanelLayoutState {
  if (!value || typeof value !== "object") return { ...DEFAULT_PANEL_LAYOUT };
  const record = value as Record<string, unknown>;
  const sidebar = typeof record.sidebar === "number" ? record.sidebar : DEFAULT_PANEL_LAYOUT.sidebar;
  const main = typeof record.main === "number" ? record.main : DEFAULT_PANEL_LAYOUT.main;
  const context = typeof record.context === "number" ? record.context : DEFAULT_PANEL_LAYOUT.context;
  return { sidebar, main, context };
}

export function layoutFromGroup(layout: Layout, hasContext: boolean): PanelLayoutState {
  const sidebar = layout.sidebar ?? DEFAULT_PANEL_LAYOUT.sidebar;
  const context = hasContext
    ? (layout.context ?? DEFAULT_PANEL_LAYOUT.context)
    : DEFAULT_PANEL_LAYOUT.context;
  const main = layout.main ?? Math.max(100 - sidebar - (hasContext ? context : 0), 30);
  return { sidebar, main, context };
}

export function createWorkspaceState(workspacePath: string): WorkspaceState {
  const normalized = workspacePath.replace(/[/\\]+$/, "");
  const name = normalized.split(/[/\\]/).pop() || "Workspace";

  return {
    path: normalized,
    name,
    currentFolder: normalized,
    currentSection: "notebook",
    recentFiles: [],
    settings: { ...DEFAULT_SETTINGS, panelLayout: { ...DEFAULT_PANEL_LAYOUT } },
  };
}
