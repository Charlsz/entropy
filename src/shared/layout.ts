/** Shared panel proportions. Renderer and session persistence use the same defaults. */

export interface PanelLayoutState {
  sidebar: number;
  main: number;
  context: number;
}

/** Notebook: sidebar | editor | context. */
export const DEFAULT_PANEL_LAYOUT: PanelLayoutState = {
  sidebar: 20,
  main: 58,
  context: 22,
};

/** Library: content | inspector. Sidebar share stays 0 because the app sidebar is outside this group. */
export const DEFAULT_INVENTORY_PANEL_LAYOUT: PanelLayoutState = {
  sidebar: 0,
  main: 72,
  context: 28,
};
