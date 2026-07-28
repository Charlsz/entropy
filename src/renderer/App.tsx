import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Titlebar } from "./components/Titlebar";
import { WorkspaceSelector } from "./components/WorkspaceSelector";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { WorkspaceProvider } from "./state/WorkspaceContext";
import { flushAll } from "./state/flushRegistry";
import { fromSessionSettings, toSessionSettings } from "./state/sessionSettings";
import type { WorkspaceSettings } from "./state/workspace";
import { DEFAULT_SETTINGS } from "./state/workspace";
import { TooltipProvider } from "./components/ui/tooltip";

export function App() {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [initialSettings, setInitialSettings] = useState<WorkspaceSettings | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const session = await window.entropy.session.load();
      if (cancelled) return;

      const settings = fromSessionSettings(session.settings);
      setInitialSettings(settings);
      document.documentElement.dataset.theme = settings.theme;

      if (session.lastWorkspace && (await window.entropy.fs.exists(session.lastWorkspace))) {
        setWorkspacePath(session.lastWorkspace);
      }
      setBooting(false);
    })();

    const unsubscribe = window.entropy.app.onBeforeQuit(async () => {
      await flushAll();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const openWorkspace = useCallback(
    async (nextPath: string) => {
      const settings = initialSettings ?? DEFAULT_SETTINGS;
      await window.entropy.session.save({
        lastWorkspace: nextPath,
        settings: toSessionSettings(settings),
      });
      setWorkspacePath(nextPath);
    },
    [initialSettings],
  );

  const closeWorkspace = useCallback(async () => {
    await flushAll();
    const settings = initialSettings ?? DEFAULT_SETTINGS;
    await window.entropy.session.save({
      lastWorkspace: null,
      settings: toSessionSettings(settings),
    });
    setWorkspacePath(null);
  }, [initialSettings]);

  let content: ReactNode;

  if (booting || !initialSettings) {
    content = (
      <div className="flex h-full flex-col bg-background">
        <Titlebar />
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <h1 className="text-lg font-medium">Entropy</h1>
          <p className="text-sm text-muted-foreground">Starting…</p>
        </div>
      </div>
    );
  } else if (!workspacePath) {
    content = (
      <div className="flex h-full flex-col bg-background" data-theme={initialSettings.theme}>
        <Titlebar />
        <WorkspaceSelector onSelect={(path) => void openWorkspace(path)} />
      </div>
    );
  } else {
    content = (
      <WorkspaceProvider
        key={workspacePath}
        path={workspacePath}
        initialSettings={initialSettings}
        onSettingsChange={(settings) => {
          setInitialSettings(settings);
          void window.entropy.session.save({
            lastWorkspace: workspacePath,
            settings: toSessionSettings(settings),
          });
        }}
        onClose={() => void closeWorkspace()}
      >
        <WorkspaceShell />
      </WorkspaceProvider>
    );
  }

  return <TooltipProvider delayDuration={200}>{content}</TooltipProvider>;
}
