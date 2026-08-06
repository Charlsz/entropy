import type { WorkspaceSettings } from "./workspace";
import {
  DEFAULT_INVENTORY_PANEL_LAYOUT,
  DEFAULT_PANEL_LAYOUT,
  normalizePanelLayout,
} from "./workspace";

export function toSessionSettings(settings: WorkspaceSettings) {
  return {
    theme: "light" as const,
    filesView: settings.filesView,
    sidebarCollapsed: settings.sidebarCollapsed,
    contextCollapsed: settings.contextCollapsed,
    inventoryTreemapCollapsed: settings.inventoryTreemapCollapsed,
    libraryPerspective: settings.libraryPerspective,
    intelligenceView: settings.intelligenceView,
    panelLayout: { ...settings.panelLayout },
    inventoryPanelLayout: { ...settings.inventoryPanelLayout },
    inventoryExtraRoots: [...settings.inventoryExtraRoots],
    lastDuplicatesCount: settings.lastDuplicatesCount,
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
    lastDuplicatesCount?: number | null;
    largeFilesApproxBytes?: number | null;
  };
  const perspective = raw.libraryPerspective;
  const intelligence = raw.intelligenceView;
  return {
    theme: "light",
    filesView: settings.filesView,
    sidebarCollapsed: Boolean(settings.sidebarCollapsed),
    contextCollapsed: Boolean(settings.contextCollapsed),
    inventoryTreemapCollapsed: Boolean(raw.inventoryTreemapCollapsed),
    libraryPerspective:
      perspective === "gallery" ||
      perspective === "large-files" ||
      perspective === "duplicates" ||
      perspective === "recent" ||
      perspective === "folders"
        ? perspective
        : "folders",
    intelligenceView:
      intelligence === "relationships" || intelligence === "copilot" ? intelligence : null,
    panelLayout: normalizePanelLayout(settings.panelLayout ?? DEFAULT_PANEL_LAYOUT),
    inventoryPanelLayout: normalizePanelLayout(
      settings.inventoryPanelLayout ?? DEFAULT_INVENTORY_PANEL_LAYOUT,
      DEFAULT_INVENTORY_PANEL_LAYOUT,
    ),
    inventoryExtraRoots: Array.isArray(settings.inventoryExtraRoots)
      ? settings.inventoryExtraRoots.filter((item): item is string => typeof item === "string")
      : [],
    lastDuplicatesCount:
      typeof raw.lastDuplicatesCount === "number"
        ? Math.max(0, Math.floor(raw.lastDuplicatesCount))
        : null,
    largeFilesApproxBytes:
      typeof raw.largeFilesApproxBytes === "number"
        ? Math.max(0, Math.floor(raw.largeFilesApproxBytes))
        : null,
  };
}
