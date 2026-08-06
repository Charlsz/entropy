import type { SectionId } from "../types/section";
import { NotebookPage } from "../pages/NotebookPage";
import { FilesPage } from "../pages/FilesPage";
import { SettingsPanel } from "./SettingsPanel";
import { cn } from "../lib/utils";

interface ContentAreaProps {
  section: SectionId;
  pendingNote?: string | null;
  onPendingNoteHandled?: () => void;
  pendingReference?: string | null;
  onPendingReferenceHandled?: () => void;
  librarySearchQuery?: string;
  onLibrarySearchQueryChange?: (query: string) => void;
}

export function ContentArea({
  section,
  pendingNote,
  onPendingNoteHandled,
  pendingReference,
  onPendingReferenceHandled,
  librarySearchQuery = "",
  onLibrarySearchQueryChange,
}: ContentAreaProps) {
  return (
    <div className="relative h-full min-h-0 w-full">
      <SectionPane active={section === "notebook"}>
        <NotebookPage
          pendingNote={pendingNote}
          onPendingNoteHandled={onPendingNoteHandled}
          pendingReference={pendingReference}
          onPendingReferenceHandled={onPendingReferenceHandled}
        />
      </SectionPane>
      <SectionPane active={section === "inventory"}>
        <FilesPage
          searchQuery={librarySearchQuery}
          onSearchQueryChange={onLibrarySearchQueryChange}
        />
      </SectionPane>
      <SectionPane active={section === "settings"}>
        <SettingsPanel />
      </SectionPane>
    </div>
  );
}

function SectionPane({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
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
