import { useEffect, useLayoutEffect, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { ContentArea } from "./ContentArea";
import { WindowControls } from "./WindowControls";
import { useWorkspace } from "../state/useWorkspace";
import { figma } from "../lib/figmaTokens";
import { WorkspaceSelector } from "./WorkspaceSelector";

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
        {needsCustomControls ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex h-9 items-center justify-end">
            <div className="pointer-events-auto no-drag flex items-center">
              <WindowControls />
            </div>
          </div>
        ) : (
          <div className="drag-region absolute inset-x-0 top-0 z-40 h-9" aria-hidden />
        )}

        <div
          className={
            workspace.currentSection === "notebook"
              ? "flex min-h-0 min-w-0 flex-1 flex-col"
              : "entropy-titlebar-pad flex min-h-0 min-w-0 flex-1 flex-col"
          }
        >
          <ContentArea
            section={workspace.currentSection}
            pendingNote={pendingNote}
            onPendingNoteHandled={clearPendingNote}
            pendingReference={pendingReference}
            onPendingReferenceHandled={clearPendingReference}
            librarySearchQuery={searchQuery}
            onLibrarySearchQueryChange={setSearchQuery}
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
