import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { ContentArea } from "./ContentArea";
import { SearchPalette } from "./SearchPalette";
import { WindowControls } from "./WindowControls";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useWorkspace } from "../state/useWorkspace";
import { figma } from "../lib/figmaTokens";
import { WorkspaceSelector } from "./WorkspaceSelector";

/**
 * Figma Entropy shell: sidebar + content only.
 * Electron drag lives on the sidebar header; window controls float top-right.
 * Workspace picker appears only when Notebook is active without a real notes folder.
 */
export function WorkspaceShell({
  needsNotebookWorkspace,
  onPickWorkspace,
}: {
  needsNotebookWorkspace: boolean;
  onPickWorkspace: (path: string) => void;
}) {
  const {
    workspace,
    pendingNote,
    clearPendingNote,
    pendingReference,
    clearPendingReference,
    visitSection,
    openNote,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useWorkspace();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    // Figma frames are light-only — keep product chrome locked to that map.
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.platform = window.entropy.platform;
  }, []);

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

  const showNotebookGate =
    needsNotebookWorkspace && workspace.currentSection === "notebook";

  return (
    <div
      className="relative flex h-full min-h-0 w-full"
      data-theme="light"
      style={{ backgroundColor: figma.canvas }}
    >
      <AppSidebar onOpenSearch={() => setSearchOpen(true)} />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex h-9 items-center justify-end pr-0">
          <div className="pointer-events-auto no-drag flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-[#6b6d69]"
                  aria-label="Settings"
                  onClick={() => visitSection("settings")}
                >
                  <Settings strokeWidth={1.75} className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>
            <WindowControls />
          </div>
        </div>

        <ContentArea
          section={workspace.currentSection}
          pendingNote={pendingNote}
          onPendingNoteHandled={clearPendingNote}
          pendingReference={pendingReference}
          onPendingReferenceHandled={clearPendingReference}
        />

        {showNotebookGate ? (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center px-6"
            style={{ backgroundColor: "color-mix(in srgb, #fafaf9 88%, transparent)" }}
          >
            <div className="w-full max-w-md">
              <WorkspaceSelector onSelect={onPickWorkspace} embedded />
            </div>
          </div>
        ) : null}
      </div>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenNote={openNote}
      />
    </div>
  );
}
