import type { SectionId } from "../types/section";
import { useWorkspace } from "../state/useWorkspace";
import { NotebookPage } from "../pages/NotebookPage";
import { FilesPage } from "../pages/FilesPage";
import { CanvasPage } from "../pages/CanvasPage";
import { Button } from "./ui/button";
import { StatusBar } from "./StatusBar";

interface ContentAreaProps {
  section: SectionId;
  pendingNote?: string | null;
  onPendingNoteHandled?: () => void;
}

export function ContentArea({
  section,
  pendingNote,
  onPendingNoteHandled,
}: ContentAreaProps) {
  return (
    <div className="relative h-full min-h-0 w-full">
      <div
        className="absolute inset-0"
        hidden={section !== "notebook"}
        aria-hidden={section !== "notebook"}
      >
        <NotebookPage
          pendingNote={pendingNote}
          onPendingNoteHandled={onPendingNoteHandled}
        />
      </div>
      <div
        className="absolute inset-0"
        hidden={section !== "files"}
        aria-hidden={section !== "files"}
      >
        <FilesPage />
      </div>
      <div
        className="absolute inset-0"
        hidden={section !== "canvas"}
        aria-hidden={section !== "canvas"}
      >
        <CanvasPage />
      </div>
      <div
        className="absolute inset-0"
        hidden={section !== "settings"}
        aria-hidden={section !== "settings"}
      >
        <SettingsPanel />
      </div>
    </div>
  );
}

function SettingsPanel() {
  const { workspace, updateSettings, clearRecentFiles, resetSettings } = useWorkspace();

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-auto p-8" aria-label="Settings">
        <div className="mx-auto max-w-lg space-y-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 break-all text-xs text-muted-foreground">{workspace.path}</p>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-[hsl(var(--panel))] px-4 py-3">
            <span className="text-sm">Files view</span>
            <select
              value={workspace.settings.filesView}
              onChange={(event) =>
                updateSettings({ filesView: event.target.value as "list" | "grid" })
              }
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="list">List</option>
              <option value="grid">Grid</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-[hsl(var(--panel))] px-4 py-3">
            <span className="text-sm">Theme</span>
            <select
              value={workspace.settings.theme}
              onChange={(event) =>
                updateSettings({ theme: event.target.value as "dark" | "light" })
              }
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-[hsl(var(--panel))] px-4 py-3">
            <span className="text-sm">Recent files</span>
            <Button type="button" variant="secondary" size="sm" onClick={clearRecentFiles}>
              Clear ({workspace.recentFiles.length})
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-[hsl(var(--panel))] px-4 py-3">
            <span className="text-sm">Defaults</span>
            <Button type="button" variant="secondary" size="sm" onClick={resetSettings}>
              Reset settings
            </Button>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-[hsl(var(--panel))] px-4 py-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Search</span>
              <span className="text-xs text-muted-foreground">Ctrl/Cmd + K</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Command palette</span>
              <span className="text-xs text-muted-foreground">Ctrl/Cmd + P</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Sections</span>
              <span className="text-xs text-muted-foreground">Ctrl/Cmd + 1–3</span>
            </div>
          </div>
        </div>
      </main>
      <StatusBar left="Settings" right={workspace.settings.theme} />
    </div>
  );
}
