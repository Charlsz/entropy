import type { WorkspaceSettings } from "./workspace";
import {
  DEFAULT_INVENTORY_PANEL_LAYOUT,
  DEFAULT_PANEL_LAYOUT,
  normalizePanelLayout,
} from "./workspace";

export function toSessionSettings(settings: WorkspaceSettings) {
  return {
    theme: settings.theme,
    filesView: settings.filesView,
    sidebarCollapsed: settings.sidebarCollapsed,
    contextCollapsed: settings.contextCollapsed,
    panelLayout: { ...settings.panelLayout },
    inventoryPanelLayout: { ...settings.inventoryPanelLayout },
    inventoryExtraRoots: [...settings.inventoryExtraRoots],
  };
}

export function fromSessionSettings(
  settings: Awaited<ReturnType<typeof window.entropy.session.load>>["settings"],
): WorkspaceSettings {
  return {
    theme: settings.theme,
    filesView: settings.filesView,
    sidebarCollapsed: Boolean(settings.sidebarCollapsed),
    contextCollapsed: Boolean(settings.contextCollapsed),
    panelLayout: normalizePanelLayout(settings.panelLayout ?? DEFAULT_PANEL_LAYOUT),
    inventoryPanelLayout: normalizePanelLayout(
      settings.inventoryPanelLayout ?? DEFAULT_INVENTORY_PANEL_LAYOUT,
      DEFAULT_INVENTORY_PANEL_LAYOUT,
    ),
    inventoryExtraRoots: Array.isArray(settings.inventoryExtraRoots)
      ? settings.inventoryExtraRoots.filter((item): item is string => typeof item === "string")
      : [],
  };
}
