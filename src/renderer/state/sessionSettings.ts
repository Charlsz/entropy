import type { WorkspaceSettings } from "./workspace";
import {
  DEFAULT_INVENTORY_PANEL_LAYOUT,
  DEFAULT_PANEL_LAYOUT,
  normalizePanelLayout,
} from "./workspace";

export function toSessionSettings(settings: WorkspaceSettings) {
  return {
    theme: settings.theme,
    sidebarCollapsed: settings.sidebarCollapsed,
    contextCollapsed: settings.contextCollapsed,
    inventoryTreemapCollapsed: settings.inventoryTreemapCollapsed,
    libraryPerspective: settings.libraryPerspective,
    uiDensity: settings.uiDensity,
    panelLayout: { ...settings.panelLayout },
    inventoryPanelLayout: { ...settings.inventoryPanelLayout },
    inventoryExtraRoots: [...settings.inventoryExtraRoots],
    libraryRootPath: settings.libraryRootPath,
    largeFilesApproxBytes: settings.largeFilesApproxBytes,
  };
}

export function fromSessionSettings(
  settings: Awaited<ReturnType<typeof window.entropy.session.load>>["settings"],
): WorkspaceSettings {
  const raw = settings as {
    libraryPerspective?: string;
    inventoryTreemapCollapsed?: boolean;
    largeFilesApproxBytes?: number | null;
    libraryRootPath?: string | null;
    uiDensity?: string;
    theme?: string;
  };
  const perspective = raw.libraryPerspective;
  const density = raw.uiDensity;
  return {
    theme: raw.theme === "dark" ? "dark" : "light",
    sidebarCollapsed: Boolean(settings.sidebarCollapsed),
    contextCollapsed: Boolean(settings.contextCollapsed),
    // Storage map is opt-in; never restore an open panel from a previous session.
    inventoryTreemapCollapsed: true,
    libraryPerspective:
      perspective === "gallery" ||
      perspective === "large-files" ||
      perspective === "duplicates" ||
      perspective === "recent" ||
      perspective === "folders"
        ? perspective
        : "folders",
    uiDensity:
      density === "comfortable" || density === "compact" || density === "default"
        ? density
        : "default",
    panelLayout: normalizePanelLayout(settings.panelLayout ?? DEFAULT_PANEL_LAYOUT),
    inventoryPanelLayout: normalizePanelLayout(
      settings.inventoryPanelLayout ?? DEFAULT_INVENTORY_PANEL_LAYOUT,
      DEFAULT_INVENTORY_PANEL_LAYOUT,
    ),
    inventoryExtraRoots: Array.isArray(settings.inventoryExtraRoots)
      ? settings.inventoryExtraRoots.filter((item): item is string => typeof item === "string")
      : [],
    libraryRootPath: typeof raw.libraryRootPath === "string" ? raw.libraryRootPath : null,
    largeFilesApproxBytes:
      typeof raw.largeFilesApproxBytes === "number"
        ? Math.max(0, Math.floor(raw.largeFilesApproxBytes))
        : null,
  };
}
