import { useEffect, useState } from "react";
import { Titlebar } from "./Titlebar";
import { AppSidebar } from "./AppSidebar";
import { ContentArea } from "./ContentArea";
import { SearchPalette } from "./SearchPalette";
import { useWorkspace } from "../state/useWorkspace";

export function WorkspaceShell() {
  const {
    workspace,
    pendingNote,
    clearPendingNote,
    pendingReference,
    clearPendingReference,
    visitSection,
    closeWorkspace,
    openNote,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useWorkspace();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.settings.theme;
    document.documentElement.dataset.platform = window.entropy.platform;
  }, [workspace.settings.theme]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && key === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (event.altKey && (key === "arrowleft" || key === "arrowright")) {
        event.preventDefault();
        if (key === "arrowleft" && canGoBack) goBack();
        if (key === "arrowright" && canGoForward) goForward();
        return;
      }
      if (mod && !event.altKey && (event.key === "[" || event.key === "]")) {
        event.preventDefault();
        if (event.key === "[" && canGoBack) goBack();
        if (event.key === "]" && canGoForward) goForward();
      }
    }

    function onMouseUp(event: MouseEvent): void {
      if (event.button === 3 && canGoBack) {
        event.preventDefault();
        goBack();
      }
      if (event.button === 4 && canGoForward) {
        event.preventDefault();
        goForward();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [canGoBack, canGoForward, goBack, goForward]);

  return (
    <div className="flex h-full flex-col bg-background" data-theme={workspace.settings.theme}>
      <Titlebar
        workspaceName={workspace.name}
        onCloseWorkspace={closeWorkspace}
        onOpenSettings={() => visitSection("settings")}
      />
      <div className="flex min-h-0 flex-1">
        <AppSidebar onOpenSearch={() => setSearchOpen(true)} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ContentArea
            section={workspace.currentSection}
            pendingNote={pendingNote}
            onPendingNoteHandled={clearPendingNote}
            pendingReference={pendingReference}
            onPendingReferenceHandled={clearPendingReference}
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
