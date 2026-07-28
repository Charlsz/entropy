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
  sidebar: 16,
  main: 66,
  context: 18,
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
  let sidebar = typeof record.sidebar === "number" ? record.sidebar : DEFAULT_PANEL_LAYOUT.sidebar;
  let main = typeof record.main === "number" ? record.main : DEFAULT_PANEL_LAYOUT.main;
  let context = typeof record.context === "number" ? record.context : DEFAULT_PANEL_LAYOUT.context;

  // Migrate the previous default proportions toward a larger main pane.
  if (
    Math.abs(sidebar - 22) < 0.5 &&
    Math.abs(main - 58) < 0.5 &&
    Math.abs(context - 20) < 0.5
  ) {
    return { ...DEFAULT_PANEL_LAYOUT };
  }

  return { sidebar, main, context };
}

export function layoutFromGroup(
  layout: Layout,
  hasContext: boolean,
  previous: PanelLayoutState = DEFAULT_PANEL_LAYOUT,
): PanelLayoutState {
  if (hasContext) {
    return {
      sidebar: layout.sidebar ?? previous.sidebar,
      main: layout.main ?? previous.main,
      context: layout.context ?? previous.context,
    };
  }

  // Two-panel groups report percentages of the non-context area only.
  // Map them back into the full three-column layout, preserving context width.
  const context = previous.context;
  const available = Math.max(100 - context, 1);
  const sidebarShare = (layout.sidebar ?? 0) / 100;
  const mainShare = (layout.main ?? 0) / 100;
  return {
    sidebar: sidebarShare * available,
    main: mainShare * available,
    context,
  };
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
