import type { Layout } from "react-resizable-panels";
import type { SectionId } from "../types/section";

export interface PanelLayoutState {
  sidebar: number;
  main: number;
  context: number;
}

export interface WorkspaceSettings {
  theme: "dark" | "light";
  sidebarCollapsed: boolean;
  contextCollapsed: boolean;
  /** Hide Inventory Storage map for a wide gallery. */
  inventoryTreemapCollapsed: boolean;
  filesView: "list" | "grid";
  panelLayout: PanelLayoutState;
  /** File Inventory: Nav | Content | Treemap */
  inventoryPanelLayout: PanelLayoutState;
  /** User-added drives/folders for Inventory indexing. */
  inventoryExtraRoots: string[];
}

/** One stop in the global Back/Forward timeline. */
export type NavKind = "folder" | "note" | "section" | "preview";

export interface NavEntry {
  kind: NavKind;
  /** Dedup key so consecutive identical locations are not stacked. */
  key: string;
  label: string;
  section: SectionId;
  folderPath?: string;
  notePath?: string;
  previewPath?: string;
}

export interface WorkspaceState {
  path: string;
  name: string;
  currentFolder: string;
  currentSection: SectionId;
  recentFiles: string[];
  settings: WorkspaceSettings;
  /** Active Inventory scan root (Home or added drive/folder). */
  inventoryScanRoot: string;
  inventoryRootLabel: string;
  /** Selected inventory file when history points at a preview. */
  inventoryFocusPath: string | null;
  /** Last note opened — used so section switches restore writing context. */
  activeNotePath: string | null;
  /** Chronological navigation across notes, folders, previews, and sections. */
  navHistory: NavEntry[];
  navHistoryIndex: number;
}

export const DEFAULT_PANEL_LAYOUT: PanelLayoutState = {
  sidebar: 16,
  main: 66,
  context: 18,
};

export const DEFAULT_INVENTORY_PANEL_LAYOUT: PanelLayoutState = {
  sidebar: 0,
  main: 50,
  context: 50,
};

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  theme: "dark",
  sidebarCollapsed: false,
  contextCollapsed: false,
  inventoryTreemapCollapsed: false,
  filesView: "grid",
  panelLayout: { ...DEFAULT_PANEL_LAYOUT },
  inventoryPanelLayout: { ...DEFAULT_INVENTORY_PANEL_LAYOUT },
  inventoryExtraRoots: [],
};

function basenameLabel(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

export function navFolder(folderPath: string, label?: string): NavEntry {
  return {
    kind: "folder",
    key: `folder:${folderPath.replace(/[/\\]+$/, "").toLowerCase()}`,
    label: label || basenameLabel(folderPath),
    section: "inventory",
    folderPath,
  };
}

export function navNote(notePath: string): NavEntry {
  const raw = basenameLabel(notePath);
  return {
    kind: "note",
    key: `note:${notePath.replace(/[/\\]+$/, "").toLowerCase()}`,
    label: raw.replace(/\.md$/i, ""),
    section: "notebook",
    notePath,
  };
}

export function navSection(section: SectionId): NavEntry {
  const labels: Record<SectionId, string> = {
    notebook: "Notebook",
    inventory: "Inventory",
    canvas: "Canvas",
    settings: "Settings",
  };
  return {
    kind: "section",
    key: `section:${section}`,
    label: labels[section],
    section,
  };
}

export function navPreview(filePath: string, folderPath: string): NavEntry {
  return {
    kind: "preview",
    key: `preview:${filePath.replace(/[/\\]+$/, "").toLowerCase()}`,
    label: basenameLabel(filePath),
    section: "inventory",
    previewPath: filePath,
    folderPath,
  };
}

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

  // Migrate Inventory from earlier three-column defaults → Content | Treemap.
  if (
    fallback === DEFAULT_INVENTORY_PANEL_LAYOUT &&
    ((Math.abs(sidebar - 20) < 0.5 && Math.abs(main - 40) < 0.5 && Math.abs(context - 40) < 0.5) ||
      (Math.abs(sidebar - 10) < 0.5 && Math.abs(main - 45) < 0.5 && Math.abs(context - 45) < 0.5))
  ) {
    return { ...DEFAULT_INVENTORY_PANEL_LAYOUT };
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
  const start = navSection("notebook");

  return {
    path: normalized,
    name,
    currentFolder: normalized,
    currentSection: "notebook",
    recentFiles: [],
    settings: {
      ...DEFAULT_SETTINGS,
      panelLayout: { ...DEFAULT_PANEL_LAYOUT },
      inventoryPanelLayout: { ...DEFAULT_INVENTORY_PANEL_LAYOUT },
    },
    inventoryScanRoot: "",
    inventoryRootLabel: "Home",
    inventoryFocusPath: null,
    activeNotePath: null,
    navHistory: [start],
    navHistoryIndex: 0,
  };
}
