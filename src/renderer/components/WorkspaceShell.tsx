import { useEffect, useLayoutEffect, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { ContentArea } from "./ContentArea";
import { WindowControls } from "./WindowControls";
import { TreemapIcon } from "./StorageTreemap";
import {
  ChromeTitlebarProvider,
  ChromeTitlebarSlot,
} from "./ChromeTitlebar";
import { useWorkspace } from "../state/useWorkspace";
import { figma } from "../lib/figmaTokens";
import { WorkspaceSelector } from "./WorkspaceSelector";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "../lib/utils";

/**
 * Entropy shell: sidebar + content.
 * Search lives in the sidebar input and drives Folders filtering (no popup palette).
 */
export function WorkspaceShell({
  needsNotebookWorkspace,
  onPickWorkspace,
}: {
  needsNotebookWorkspace: boolean;
  onPickWorkspace: (path: string) => void;
}) {
  return (
    <ChromeTitlebarProvider>
      <WorkspaceShellFrame
        needsNotebookWorkspace={needsNotebookWorkspace}
        onPickWorkspace={onPickWorkspace}
      />
    </ChromeTitlebarProvider>
  );
}

function WorkspaceShellFrame({
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
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    visitSection,
    updateSettings,
  } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  const needsCustomControls = Boolean(window.entropy.window?.needsCustomControls);
  const theme = workspace.settings.theme;
  const density = workspace.settings.uiDensity ?? "default";
  const perspective = workspace.settings.libraryPerspective;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.platform = window.entropy.platform;
    void window.entropy.window.setChromeTheme?.(theme);
  }, [theme, density]);

  useEffect(() => {
    if (perspective !== "duplicates") setDuplicateCount(null);
  }, [perspective]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && key === "k") {
        event.preventDefault();
        focusLibrarySearch();
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

    function onDupCount(event: Event): void {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === "number") setDuplicateCount(detail);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("entropy:duplicates-count", onDupCount);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("entropy:duplicates-count", onDupCount);
    };
  }, [canGoBack, canGoForward, goBack, goForward]);

  function focusLibrarySearch(): void {
    updateSettings({ libraryPerspective: "folders", intelligenceView: null });
    visitSection("inventory");
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>("[data-entropy-search]");
      input?.focus();
    }, 0);
  }

  const showNotebookGate =
    needsNotebookWorkspace && workspace.currentSection === "notebook";

  const densityZoom =
    density === "comfortable" ? 1.08 : density === "compact" ? 0.92 : 1;

  const treemapCollapsed = workspace.settings.inventoryTreemapCollapsed ?? true;
  const showTreemapToggle =
    workspace.currentSection === "inventory" && perspective === "folders";

  return (
    <div
      className="relative flex h-full min-h-0 w-full origin-top-left"
      data-theme={theme}
      data-density={density}
      style={{
        backgroundColor: figma.canvas,
        zoom: densityZoom,
      }}
    >
      <AppSidebar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchFocus={focusLibrarySearch}
        duplicateCount={duplicateCount}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/*
          One real caption strip: parent is drag, interactive children are no-drag.
          Absolute overlays + sibling drag regions break click/hit-testing on Electron.
        */}
        <header
          className="drag-region flex h-9 shrink-0 items-center border-b"
          style={{ backgroundColor: figma.canvas, borderColor: figma.border }}
        >
          <ChromeTitlebarSlot className="flex min-w-0 flex-1 items-center overflow-hidden" />
          <div className="no-drag flex shrink-0 items-center gap-0.5 pr-1">
            {showTreemapToggle ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-select hover:text-foreground",
                      !treemapCollapsed && "text-foreground",
                    )}
                    aria-label={treemapCollapsed ? "Show storage map" : "Hide storage map"}
                    aria-pressed={!treemapCollapsed}
                    onClick={() =>
                      updateSettings({ inventoryTreemapCollapsed: !treemapCollapsed })
                    }
                  >
                    <TreemapIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  {treemapCollapsed ? "Show storage map" : "Hide storage map"}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {needsCustomControls ? <WindowControls /> : null}
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ContentArea
            section={workspace.currentSection}
            pendingNote={pendingNote}
            onPendingNoteHandled={clearPendingNote}
            pendingReference={pendingReference}
            onPendingReferenceHandled={clearPendingReference}
            librarySearchQuery={searchQuery}
            onPickWorkspace={onPickWorkspace}
          />
        </div>

        {showNotebookGate ? (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center px-6"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-surface) 88%, transparent)",
            }}
          >
            <div className="w-full max-w-md">
              <WorkspaceSelector onSelect={onPickWorkspace} embedded />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
