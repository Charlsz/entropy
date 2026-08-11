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
    inventoryTreemapCollapsed: settings.inventoryTreemapCollapsed,
    inventoryFolderTreeCollapsed: settings.inventoryFolderTreeCollapsed,
    libraryPerspective: settings.libraryPerspective,
    intelligenceView: settings.intelligenceView,
    uiDensity: settings.uiDensity,
    panelLayout: { ...settings.panelLayout },
    inventoryPanelLayout: { ...settings.inventoryPanelLayout },
    inventoryExtraRoots: [...settings.inventoryExtraRoots],
    largeFilesApproxBytes: settings.largeFilesApproxBytes,
  };
}

export function fromSessionSettings(
  settings: Awaited<ReturnType<typeof window.entropy.session.load>>["settings"],
): WorkspaceSettings {
  const raw = settings as {
    libraryPerspective?: string;
    intelligenceView?: string | null;
    inventoryTreemapCollapsed?: boolean;
    inventoryFolderTreeCollapsed?: boolean;
    largeFilesApproxBytes?: number | null;
    uiDensity?: string;
    theme?: string;
  };
  const perspective = raw.libraryPerspective;
  const intelligence = raw.intelligenceView;
  const density = raw.uiDensity;
  return {
    theme: raw.theme === "light" ? "light" : "dark",
    filesView: settings.filesView,
    sidebarCollapsed: Boolean(settings.sidebarCollapsed),
    contextCollapsed: Boolean(settings.contextCollapsed),
    // Storage map is opt-in; never restore an open panel from a previous session.
    inventoryTreemapCollapsed: true,
    inventoryFolderTreeCollapsed: Boolean(raw.inventoryFolderTreeCollapsed),
    libraryPerspective:
      perspective === "gallery" ||
      perspective === "large-files" ||
      perspective === "duplicates" ||
      perspective === "folders"
        ? perspective
        : "folders",
    intelligenceView:
      intelligence === "relationships" || intelligence === "copilot" ? intelligence : null,
    uiDensity:
      density === "comfortable" || density === "compact" || density === "default"
        ? density
        : "default",
    panelLayout: normalizePanelLayout(settings.panelLayout ?? DEFAULT_PANEL_LAYOUT),
    inventoryPanelLayout: (() => {
      const layout = normalizePanelLayout(
        settings.inventoryPanelLayout ?? DEFAULT_INVENTORY_PANEL_LAYOUT,
        DEFAULT_INVENTORY_PANEL_LAYOUT,
      );
      // Older sessions stored sidebar:0 when Library had no tree column.
      if (!raw.inventoryFolderTreeCollapsed && layout.sidebar < 8) {
        return { ...DEFAULT_INVENTORY_PANEL_LAYOUT };
      }
      return layout;
    })(),
    inventoryExtraRoots: Array.isArray(settings.inventoryExtraRoots)
      ? settings.inventoryExtraRoots.filter((item): item is string => typeof item === "string")
      : [],
    largeFilesApproxBytes:
      typeof raw.largeFilesApproxBytes === "number"
        ? Math.max(0, Math.floor(raw.largeFilesApproxBytes))
        : null,
  };
}
