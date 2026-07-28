import { useCallback, useEffect, useState } from "react";
import { Titlebar } from "./Titlebar";
import { IconRail } from "./IconRail";
import { ContentArea } from "./ContentArea";
import { SearchPalette } from "./SearchPalette";
import { useWorkspace } from "../state/useWorkspace";

export function WorkspaceShell() {
  const {
    workspace,
    pendingNote,
    clearPendingNote,
    setSection,
    closeWorkspace,
    openNote,
    updateSettings,
  } = useWorkspace();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.settings.theme;
  }, [workspace.settings.theme]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || key !== "k") return;
      event.preventDefault();
      setSearchOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleSidebar = useCallback(() => {
    updateSettings({ sidebarCollapsed: !workspace.settings.sidebarCollapsed });
  }, [updateSettings, workspace.settings.sidebarCollapsed]);

  const toggleContext = useCallback(() => {
    updateSettings({ contextCollapsed: !workspace.settings.contextCollapsed });
  }, [updateSettings, workspace.settings.contextCollapsed]);

  return (
    <div className="flex h-full flex-col bg-background" data-theme={workspace.settings.theme}>
      <Titlebar
        workspaceName={workspace.name}
        showPanelToggles
        sidebarCollapsed={workspace.settings.sidebarCollapsed}
        contextCollapsed={workspace.settings.contextCollapsed}
        onToggleSidebar={toggleSidebar}
        onToggleContext={toggleContext}
        onCloseWorkspace={closeWorkspace}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSection("settings")}
      />
      <div className="flex min-h-0 flex-1">
        <IconRail active={workspace.currentSection} onChange={setSection} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ContentArea
            section={workspace.currentSection}
            pendingNote={pendingNote}
            onPendingNoteHandled={clearPendingNote}
          />
        </div>
      </div>
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenNote={openNote}
      />
    </div>
  );
}
