import type { SectionId } from "./Sidebar";
import { useWorkspace } from "../state/useWorkspace";
import { NotebookPage } from "../pages/NotebookPage";
import { FilesPage } from "../pages/FilesPage";
import { CanvasPage } from "../pages/CanvasPage";

interface ContentAreaProps {
  section: SectionId;
  pendingNote?: string | null;
  onPendingNoteHandled?: () => void;
}

const LABELS: Record<SectionId, string> = {
  notebook: "Notebook",
  files: "Files",
  canvas: "Canvas",
  settings: "Settings",
};

export function ContentArea({
  section,
  pendingNote,
  onPendingNoteHandled,
}: ContentAreaProps) {
  if (section === "notebook") {
    return (
      <NotebookPage
        pendingNote={pendingNote}
        onPendingNoteHandled={onPendingNoteHandled}
      />
    );
  }

  if (section === "files") {
    return <FilesPage />;
  }

  if (section === "canvas") {
    return <CanvasPage />;
  }

  if (section === "settings") {
    return <SettingsPanel />;
  }

  return (
    <main className="content-area" aria-label={LABELS[section]}>
      <div className="content-empty">
        <h1>{LABELS[section]}</h1>
        <p>This section is ready for content.</p>
      </div>
    </main>
  );
}

function SettingsPanel() {
  const { workspace, updateSettings, clearRecentFiles } = useWorkspace();

  return (
    <main className="content-area" aria-label="Settings">
      <div className="settings-panel">
        <h1>Settings</h1>
        <p className="settings-path">{workspace.path}</p>

        <label className="settings-row">
          <span>Files view</span>
          <select
            value={workspace.settings.filesView}
            onChange={(event) =>
              updateSettings({ filesView: event.target.value as "list" | "grid" })
            }
          >
            <option value="list">List</option>
            <option value="grid">Grid</option>
          </select>
        </label>

        <label className="settings-row">
          <span>Theme</span>
          <select
            value={workspace.settings.theme}
            onChange={(event) =>
              updateSettings({ theme: event.target.value as "dark" | "light" })
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <div className="settings-row">
          <span>Recent files</span>
          <button type="button" className="btn btn-secondary" onClick={clearRecentFiles}>
            Clear ({workspace.recentFiles.length})
          </button>
        </div>

        <div className="settings-row">
          <span>Search</span>
          <span className="settings-hint">Ctrl/Cmd + K</span>
        </div>
        <div className="settings-row">
          <span>Command palette</span>
          <span className="settings-hint">Ctrl/Cmd + P</span>
        </div>
        <div className="settings-row">
          <span>Sections</span>
          <span className="settings-hint">Ctrl/Cmd + 1–3</span>
        </div>
      </div>
    </main>
  );
}
