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
  /** File Inventory: Nav | Content | Treemap */
  inventoryPanelLayout: PanelLayoutState;
  /** User-added drives/folders for Inventory indexing. */
  inventoryExtraRoots: string[];
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

export const DEFAULT_INVENTORY_PANEL_LAYOUT: PanelLayoutState = {
  sidebar: 20,
  main: 40,
  context: 40,
};

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  theme: "dark",
  sidebarCollapsed: false,
  contextCollapsed: false,
  filesView: "grid",
  panelLayout: { ...DEFAULT_PANEL_LAYOUT },
  inventoryPanelLayout: { ...DEFAULT_INVENTORY_PANEL_LAYOUT },
  inventoryExtraRoots: [],
};

export function normalizePanelLayout(
  value: unknown,
  fallback: PanelLayoutState = DEFAULT_PANEL_LAYOUT,
): PanelLayoutState {
  if (!value || typeof value !== "object") return { ...fallback };
  const record = value as Record<string, unknown>;
  let sidebar = typeof record.sidebar === "number" ? record.sidebar : fallback.sidebar;
  let main = typeof record.main === "number" ? record.main : fallback.main;
  let context = typeof record.context === "number" ? record.context : fallback.context;

  // Migrate the previous default proportions toward a larger main pane.
  if (
    fallback === DEFAULT_PANEL_LAYOUT &&
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
    settings: { ...DEFAULT_SETTINGS, panelLayout: { ...DEFAULT_PANEL_LAYOUT }, inventoryPanelLayout: { ...DEFAULT_INVENTORY_PANEL_LAYOUT } },
  };
}
