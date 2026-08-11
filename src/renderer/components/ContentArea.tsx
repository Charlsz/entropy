import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { SectionId } from "../types/section";
import { cn } from "../lib/utils";

const NotebookPage = lazy(async () => {
  const mod = await import("../pages/NotebookPage");
  return { default: mod.NotebookPage };
});

const FilesPage = lazy(async () => {
  const mod = await import("../pages/FilesPage");
  return { default: mod.FilesPage };
});

const SettingsPanel = lazy(async () => {
  const mod = await import("./SettingsPanel");
  return { default: mod.SettingsPanel };
});

interface ContentAreaProps {
  section: SectionId;
  pendingNote?: string | null;
  onPendingNoteHandled?: () => void;
  pendingReference?: string | null;
  onPendingReferenceHandled?: () => void;
  librarySearchQuery?: string;
  onLibrarySearchQueryChange?: (query: string) => void;
  onPickWorkspace?: (path: string) => void;
  /** True when Notebook has no notes workspace (library-only / empty recents). */
  needsNotebookWorkspace?: boolean;
}

/**
 * Mounts each major section on first visit and keeps it warm afterwards.
 * TipTap / Library virtualizers stay out of the initial bundle until needed.
 */
export function ContentArea({
  section,
  pendingNote,
  onPendingNoteHandled,
  pendingReference,
  onPendingReferenceHandled,
  librarySearchQuery = "",
  onLibrarySearchQueryChange,
  onPickWorkspace,
  needsNotebookWorkspace = false,
}: ContentAreaProps) {
  const [visited, setVisited] = useState<Record<SectionId, boolean>>(() => ({
    notebook: section === "notebook",
    inventory: section === "inventory",
    settings: section === "settings",
  }));

  useEffect(() => {
    setVisited((prev) => (prev[section] ? prev : { ...prev, [section]: true }));
  }, [section]);

  return (
    <div className="relative h-full min-h-0 w-full">
      {visited.notebook ? (
        <SectionPane active={section === "notebook"}>
          <Suspense fallback={<SectionFallback label="Opening Notebook…" />}>
            <NotebookPage
              pendingNote={pendingNote}
              onPendingNoteHandled={onPendingNoteHandled}
              pendingReference={pendingReference}
              onPendingReferenceHandled={onPendingReferenceHandled}
              onPickWorkspace={onPickWorkspace}
              needsNotebookWorkspace={needsNotebookWorkspace}
            />
          </Suspense>
        </SectionPane>
      ) : null}
      {visited.inventory ? (
        <SectionPane active={section === "inventory"}>
          <Suspense fallback={<SectionFallback label="Opening Library…" />}>
            <FilesPage
              searchQuery={librarySearchQuery}
              onSearchQueryChange={onLibrarySearchQueryChange}
            />
          </Suspense>
        </SectionPane>
      ) : null}
      {visited.settings ? (
        <SectionPane active={section === "settings"}>
          <Suspense fallback={<SectionFallback label="Opening Settings…" />}>
            <SettingsPanel />
          </Suspense>
        </SectionPane>
      ) : null}
    </div>
  );
}

function SectionPane({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0",
        active ? "z-10" : "pointer-events-none invisible z-0",
      )}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

function SectionFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
