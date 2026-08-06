import { Eraser, FolderOpen, RotateCcw } from "lucide-react";
import { useWorkspace } from "../state/useWorkspace";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { StatusBar } from "./StatusBar";
import { Switch } from "./ui/switch";
import { osRevealLabel } from "../lib/platform";

function pathLabel(filePath: string): string {
  const cleaned = filePath.replace(/[/\\]+$/, "");
  const parts = cleaned.split(/[/\\]/);
  return parts[parts.length - 1] || cleaned;
}

/**
 * Minimal local settings — appearance + quiet maintenance.
 * No dashboards, no account chrome.
 */
export function SettingsPanel() {
  const { workspace, updateSettings, clearRecentFiles, resetSettings, openFileLocation } =
    useWorkspace();
  const dark = workspace.settings.theme === "dark";
  const recentFiles = workspace.recentFiles;
  const recentCount = recentFiles.length;

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-auto" aria-label="Settings">
        <div className="mx-auto w-full max-w-md px-6 py-10">
          <header className="mb-10">
            <h1 className="text-lg font-medium tracking-tight text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Local to this workspace.</p>
          </header>

          <section className="space-y-1" aria-labelledby="settings-appearance">
            <h2
              id="settings-appearance"
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Appearance
            </h2>
            <div className="flex items-center justify-between gap-6 py-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground">Dark theme</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Optional. Light is the default Figma Entropy look.
                </p>
              </div>
              <Switch
                id="theme-switch"
                checked={dark}
                aria-label="Dark theme"
                onCheckedChange={(checked) =>
                  updateSettings({ theme: checked ? "dark" : "light" })
                }
              />
            </div>
          </section>

          <div className="my-8 h-px bg-border" />

          <section className="space-y-1" aria-labelledby="settings-workspace">
            <h2
              id="settings-workspace"
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Workspace
            </h2>
            <div className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{workspace.name}</p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                  {workspace.path}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                aria-label={osRevealLabel()}
                onClick={() => void window.entropy.fs.reveal(workspace.path)}
              >
                <FolderOpen className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </div>

            <div className="py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">Recent files</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {recentCount === 0
                      ? "None remembered yet"
                      : `${recentCount} path${recentCount === 1 ? "" : "s"} in history`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground"
                  disabled={recentCount === 0}
                  onClick={clearRecentFiles}
                >
                  <Eraser className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Clear
                </Button>
              </div>

              {recentCount > 0 ? (
                <ScrollArea className="mt-3 h-44 rounded-lg border border-border bg-card" type="always">
                  <ul className="divide-y divide-border px-1 py-1" aria-label="Recent files">
                    {recentFiles.map((filePath) => (
                      <li key={filePath}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          title={filePath}
                          onClick={() => void openFileLocation(filePath)}
                        >
                          <span className="truncate text-sm text-foreground">{pathLabel(filePath)}</span>
                          <span className="truncate font-mono text-[10px] text-muted-foreground">
                            {filePath}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : null}
            </div>
          </section>

          <div className="my-8 h-px bg-border" />

          <section aria-labelledby="settings-reset">
            <h2
              id="settings-reset"
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Reset
            </h2>
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground">Restore defaults</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Theme, panel sizes, and Inventory extras for this workspace.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={resetSettings}
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                Reset
              </Button>
            </div>
          </section>
        </div>
      </main>
      <StatusBar left={workspace.path} right={dark ? "Dark" : "Light"} />
    </div>
  );
}
