import type { WorkspaceSettings } from "./workspace";

export function toSessionSettings(settings: WorkspaceSettings) {
  return {
    theme: settings.theme,
    filesView: settings.filesView,
    sidebarCollapsed: settings.sidebarCollapsed,
    contextCollapsed: settings.contextCollapsed,
    panelLayout: { ...settings.panelLayout },
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
    panelLayout: {
      sidebar: settings.panelLayout?.sidebar ?? 22,
      main: settings.panelLayout?.main ?? 58,
      context: settings.panelLayout?.context ?? 20,
    },
  };
}
