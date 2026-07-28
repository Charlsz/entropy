import { useCallback, useEffect, useState } from "react";
import { Titlebar } from "./components/Titlebar";
import { WorkspaceSelector } from "./components/WorkspaceSelector";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { WorkspaceProvider } from "./state/WorkspaceContext";
import { flushAll } from "./state/flushRegistry";
import type { WorkspaceSettings } from "./state/workspace";

export function App() {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [initialSettings, setInitialSettings] = useState<WorkspaceSettings | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const session = await window.entropy.session.load();
      if (cancelled) return;

      const settings: WorkspaceSettings = {
        theme: session.settings.theme,
        filesView: session.settings.filesView,
        sidebarCollapsed: false,
      };
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
      const settings = initialSettings ?? {
        theme: "dark" as const,
        filesView: "grid" as const,
        sidebarCollapsed: false,
      };
      await window.entropy.session.save({
        lastWorkspace: nextPath,
        settings: { theme: settings.theme, filesView: settings.filesView },
      });
      setWorkspacePath(nextPath);
    },
    [initialSettings],
  );

  const closeWorkspace = useCallback(async () => {
    await flushAll();
    const settings = initialSettings ?? {
      theme: "dark" as const,
      filesView: "grid" as const,
      sidebarCollapsed: false,
    };
    await window.entropy.session.save({
      lastWorkspace: null,
      settings: { theme: settings.theme, filesView: settings.filesView },
    });
    setWorkspacePath(null);
  }, [initialSettings]);

  if (booting || !initialSettings) {
    return (
      <div className="flex h-full flex-col bg-background">
        <Titlebar />
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <h1 className="text-lg font-medium">Entropy</h1>
          <p className="text-sm text-muted-foreground">Starting…</p>
        </div>
      </div>
    );
  }

  if (!workspacePath) {
    return (
      <div className="flex h-full flex-col bg-background" data-theme={initialSettings.theme}>
        <Titlebar />
        <WorkspaceSelector onSelect={(path) => void openWorkspace(path)} />
      </div>
    );
  }

  return (
    <WorkspaceProvider
      key={workspacePath}
      path={workspacePath}
      initialSettings={initialSettings}
      onSettingsChange={(settings) => {
        setInitialSettings(settings);
        void window.entropy.session.save({
          lastWorkspace: workspacePath,
          settings: { theme: settings.theme, filesView: settings.filesView },
        });
      }}
      onClose={() => void closeWorkspace()}
    >
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}
