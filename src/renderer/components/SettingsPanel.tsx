import { RotateCcw } from "lucide-react";
import { useWorkspace } from "../state/useWorkspace";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { cn } from "../lib/utils";
import type { WorkspaceSettings } from "../state/workspace";

type UiDensity = WorkspaceSettings["uiDensity"];

const DENSITY_OPTIONS: Array<{ id: UiDensity; label: string; hint: string }> = [
  { id: "comfortable", label: "Comfortable", hint: "Larger type and icons" },
  { id: "default", label: "Default", hint: "Balanced reading density" },
  { id: "compact", label: "Compact", hint: "More rows on screen" },
];

/**
 * Sparse preferences — appearance and a few essentials.
 * Workspace pick lives in Notebook; recent files are not a Settings concern.
 */
export function SettingsPanel() {
  const { workspace, updateSettings, resetSettings } = useWorkspace();
  const dark = workspace.settings.theme === "dark";
  const density = workspace.settings.uiDensity ?? "default";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <main className="min-h-0 flex-1 overflow-y-auto" aria-label="Settings">
        <div className="mx-auto w-full max-w-lg px-8 py-10">
          <header className="mb-8">
            <h1 className="text-lg font-medium tracking-tight text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Local preferences for this machine.
            </p>
          </header>

          <section aria-labelledby="settings-appearance">
            <h2
              id="settings-appearance"
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Appearance
            </h2>

            <div className="flex items-center justify-between gap-6 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">Dark theme</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Soft light by default. Dark uses deep ink chrome.
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

            <div className="py-3">
              <p className="text-sm text-foreground">Density</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Font and icon size for chrome and lists.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {DENSITY_OPTIONS.map((option) => {
                  const active = density === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
                        active
                          ? "border-foreground/25 bg-select text-foreground"
                          : "border-border text-muted-foreground hover:bg-panel hover:text-foreground",
                      )}
                      onClick={() => updateSettings({ uiDensity: option.id })}
                    >
                      <span className="block text-xs font-medium">{option.label}</span>
                      <span className="mt-1 block text-[11px] leading-snug opacity-80">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="my-8 h-px bg-border" />

          <section aria-labelledby="settings-library">
            <h2
              id="settings-library"
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Library
            </h2>
            <div className="flex items-center justify-between gap-6 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">Hide storage map</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Keep perspectives wide; leave the treemap collapsed.
                </p>
              </div>
              <Switch
                id="treemap-switch"
                checked={Boolean(workspace.settings.inventoryTreemapCollapsed)}
                aria-label="Hide storage map"
                onCheckedChange={(checked) =>
                  updateSettings({ inventoryTreemapCollapsed: checked })
                }
              />
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
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">Restore defaults</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Theme, density, panel sizes, and Library extras.
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
    </div>
  );
}
