import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Titlebar } from "./components/Titlebar";
import { WorkspaceSelector } from "./components/WorkspaceSelector";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { WorkspaceProvider } from "./state/WorkspaceContext";
import { DuplicatesWindow } from "./pages/DuplicatesWindow";
import { flushAll } from "./state/flushRegistry";
import { fromSessionSettings, toSessionSettings } from "./state/sessionSettings";
import type { WorkspaceSettings } from "./state/workspace";
import { DEFAULT_SETTINGS } from "./state/workspace";
import { TooltipProvider } from "./components/ui/tooltip";

function readWindowMode(): { kind: "duplicates"; root: string } | { kind: "main" } {
  const params = new URLSearchParams(window.location.search);
  if (params.get("window") === "duplicates") {
    return { kind: "duplicates", root: params.get("root") ?? "" };
  }
  return { kind: "main" };
}

export function App() {
  const mode = readWindowMode();
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [initialSettings, setInitialSettings] = useState<WorkspaceSettings | null>(null);
  const [booting, setBooting] = useState(mode.kind === "main");
  const saveTimer = useRef<number | null>(null);
  const latestSettings = useRef<WorkspaceSettings | null>(null);
  const latestWorkspace = useRef<string | null>(null);

  const persistSession = useCallback((nextPath: string | null, settings: WorkspaceSettings) => {
    latestSettings.current = settings;
    latestWorkspace.current = nextPath;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void window.entropy.session.save({
        lastWorkspace: latestWorkspace.current,
        settings: toSessionSettings(latestSettings.current ?? settings),
      });
    }, 250);
  }, []);

  useEffect(() => {
    if (mode.kind === "duplicates") return;

    let cancelled = false;

    void (async () => {
      try {
        const session = await window.entropy.session.load();
        if (cancelled) return;

        const settings = fromSessionSettings(session.settings);
        setInitialSettings(settings);
        latestSettings.current = settings;
        latestWorkspace.current = session.lastWorkspace;
        document.documentElement.dataset.theme = settings.theme;

        if (session.lastWorkspace && (await window.entropy.fs.exists(session.lastWorkspace))) {
          setWorkspacePath(session.lastWorkspace);
        }
      } catch {
        if (!cancelled) setInitialSettings(DEFAULT_SETTINGS);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    const unsubscribe = window.entropy.app.onBeforeQuit(async () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const settings = latestSettings.current ?? DEFAULT_SETTINGS;
      await window.entropy.session.save({
        lastWorkspace: latestWorkspace.current,
        settings: toSessionSettings(settings),
      });
      await flushAll();
    });

    return () => {
      cancelled = true;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      unsubscribe();
    };
  }, [mode.kind]);

  const openWorkspace = useCallback(
    async (nextPath: string) => {
      const settings = initialSettings ?? DEFAULT_SETTINGS;
      await window.entropy.session.save({
        lastWorkspace: nextPath,
        settings: toSessionSettings(settings),
      });
      latestWorkspace.current = nextPath;
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
    latestWorkspace.current = null;
    setWorkspacePath(null);
  }, [initialSettings]);

  if (mode.kind === "duplicates") {
    return (
      <TooltipProvider delayDuration={200}>
        <DuplicatesWindow initialRoot={mode.root} />
      </TooltipProvider>
    );
  }

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
          persistSession(workspacePath, settings);
        }}
        onClose={() => void closeWorkspace()}
      >
        <WorkspaceShell />
      </WorkspaceProvider>
    );
  }

  return <TooltipProvider delayDuration={200}>{content}</TooltipProvider>;
}
