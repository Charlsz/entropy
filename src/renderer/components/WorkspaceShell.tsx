import { useCallback, useEffect, useState } from "react";
import { Titlebar } from "../components/Titlebar";
import { Sidebar } from "../components/Sidebar";
import { ContentArea } from "../components/ContentArea";
import { SearchPalette } from "../components/SearchPalette";
import { useWorkspace } from "../state/WorkspaceContext";

export function WorkspaceShell() {
  const { workspace, setSection, closeWorkspace, addRecentFile } = useWorkspace();
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingNote, setPendingNote] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && key === "f" && !event.shiftKey) {
        // Keep Ctrl+F for in-page find; use Ctrl+Shift+F for workspace search fallback.
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "f") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleOpenNote = useCallback(
    (path: string) => {
      addRecentFile(path);
      setSection("notebook");
      setPendingNote(path);
    },
    [addRecentFile, setSection],
  );

  return (
    <div className="app-shell">
      <Titlebar
        workspaceName={workspace.name}
        onCloseWorkspace={closeWorkspace}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <div className="app-body">
        <Sidebar active={workspace.currentSection} onChange={setSection} />
        <ContentArea section={workspace.currentSection} pendingNote={pendingNote} onPendingNoteHandled={() => setPendingNote(null)} />
      </div>
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenNote={handleOpenNote}
      />
    </div>
  );
}
