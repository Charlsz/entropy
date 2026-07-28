import type { SectionId } from "../types/section";
import { useWorkspace } from "../state/useWorkspace";
import { NotebookPage } from "../pages/NotebookPage";
import { FilesPage } from "../pages/FilesPage";
import { CanvasPage } from "../pages/CanvasPage";
import { Button } from "./ui/button";
import { StatusBar } from "./StatusBar";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Eraser, RotateCcw } from "lucide-react";
import { cn } from "../lib/utils";

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
      <SectionPane active={section === "notebook"}>
        <NotebookPage
          pendingNote={pendingNote}
          onPendingNoteHandled={onPendingNoteHandled}
        />
      </SectionPane>
      <SectionPane active={section === "files"}>
        <FilesPage />
      </SectionPane>
      <SectionPane active={section === "canvas"}>
        <CanvasPage />
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

function SettingsPanel() {
  const { workspace, updateSettings, clearRecentFiles, resetSettings } = useWorkspace();
  const dark = workspace.settings.theme === "dark";

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-auto p-8" aria-label="Settings">
        <div className="mx-auto max-w-lg space-y-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-paper">Settings</h1>
            <p className="mt-1 break-all text-xs text-paper-2">{workspace.path}</p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-ink-2 px-4 py-3">
            <Label htmlFor="files-view">Files view</Label>
            <Select
              value={workspace.settings.filesView}
              onValueChange={(value) =>
                updateSettings({ filesView: value as "list" | "grid" })
              }
            >
              <SelectTrigger id="files-view" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-ink-2 px-4 py-3">
            <Label htmlFor="theme-switch">Dark theme</Label>
            <Switch
              id="theme-switch"
              checked={dark}
              onCheckedChange={(checked) =>
                updateSettings({ theme: checked ? "dark" : "light" })
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-ink-2 px-4 py-3">
            <span className="text-sm text-paper">
              Recent files
              <span className="ml-2 text-xs text-paper-2">({workspace.recentFiles.length})</span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Clear recent files"
                  onClick={clearRecentFiles}
                >
                  <Eraser className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear recent files</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-ink-2 px-4 py-3">
            <span className="text-sm text-paper">Defaults</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Reset settings"
                  onClick={resetSettings}
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset settings</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </main>
      <StatusBar left="Settings" right={workspace.settings.theme} />
    </div>
  );
}
