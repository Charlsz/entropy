import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { WorkspaceSelector } from "./components/WorkspaceSelector";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { WorkspaceProvider } from "./state/WorkspaceContext";
import { WindowControls } from "./components/WindowControls";
import { flushAll } from "./state/flushRegistry";
import { fromSessionSettings, toSessionSettings } from "./state/sessionSettings";
import type { WorkspaceSettings } from "./state/workspace";
import { DEFAULT_SETTINGS } from "./state/workspace";
import { TooltipProvider } from "./components/ui/tooltip";
import { samePath } from "./lib/platform";
import { figma } from "./lib/figmaTokens";

export function App() {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  /** True when path is only a Library bootstrap (Home) — Notebook must pick a notes folder. */
  const [libraryOnly, setLibraryOnly] = useState(false);
  const [initialSettings, setInitialSettings] = useState<WorkspaceSettings | null>(null);
  const [booting, setBooting] = useState(true);
  const [pendingNotePath, setPendingNotePath] = useState<string | null>(null);
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
    let cancelled = false;

    void (async () => {
      try {
        const session = await window.entropy.session.load();
        if (cancelled) return;

        // Dark is the product default; respect an explicit saved light theme.
        const settings = fromSessionSettings(session.settings);
        setInitialSettings(settings);
        latestSettings.current = settings;
        document.documentElement.dataset.theme = settings.theme;
        document.body.dataset.theme = settings.theme;
        document.documentElement.dataset.density = settings.uiDensity;
        void window.entropy.window.setChromeTheme?.(settings.theme);

        if (session.lastWorkspace && (await window.entropy.fs.exists(session.lastWorkspace))) {
          await window.entropy.workspace.remember(session.lastWorkspace).catch(() => undefined);
          latestWorkspace.current = session.lastWorkspace;
          setLibraryOnly(false);
          setWorkspacePath(session.lastWorkspace);
        } else {
          // Library does not need a notes workspace — bootstrap from Home.
          const home = await window.entropy.fs.getHomePath();
          latestWorkspace.current = null;
          setLibraryOnly(true);
          setWorkspacePath(home);
        }
      } catch {
        if (!cancelled) {
          const settings = { ...DEFAULT_SETTINGS };
          setInitialSettings(settings);
          latestSettings.current = settings;
          document.documentElement.dataset.theme = settings.theme;
          document.body.dataset.theme = settings.theme;
          document.documentElement.dataset.density = settings.uiDensity;
          try {
            const home = await window.entropy.fs.getHomePath();
            setLibraryOnly(true);
            setWorkspacePath(home);
          } catch {
            setWorkspacePath(null);
          }
        }
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
  }, []);

  const openWorkspace = useCallback(
    async (nextPath: string, notePath?: string | null) => {
      const settings = initialSettings ?? DEFAULT_SETTINGS;
      await window.entropy.workspace.remember(nextPath).catch(() => undefined);
      await window.entropy.session.save({
        lastWorkspace: nextPath,
        settings: toSessionSettings(settings),
      });
      latestWorkspace.current = nextPath;
      setLibraryOnly(false);
      setPendingNotePath(notePath ?? null);
      setWorkspacePath(nextPath);
      setInitialSettings(settings);
    },
    [initialSettings],
  );

  const switchWorkspace = useCallback(
    async (nextPath: string, notePath: string) => {
      if (workspacePath && samePath(nextPath, workspacePath) && !libraryOnly) return;
      await flushAll();
      await openWorkspace(nextPath, notePath);
    },
    [openWorkspace, workspacePath, libraryOnly],
  );

  const closeWorkspace = useCallback(async () => {
    await flushAll();
    const settings = initialSettings ?? DEFAULT_SETTINGS;
    await window.entropy.session.save({
      lastWorkspace: null,
      settings: toSessionSettings(settings),
    });
    latestWorkspace.current = null;
    setPendingNotePath(null);
    setLibraryOnly(true);
    try {
      const home = await window.entropy.fs.getHomePath();
      setWorkspacePath(home);
    } catch {
      setWorkspacePath(null);
    }
  }, [initialSettings]);

  let content: ReactNode;

  if (booting || !initialSettings) {
    content = (
      <div
        className="relative flex h-full flex-col items-center justify-center"
        data-theme={initialSettings?.theme ?? "dark"}
        style={{ backgroundColor: figma.surface }}
      >
        <div className="absolute right-0 top-0">
          <WindowControls />
        </div>
        <p className="text-[14px] font-semibold" style={{ color: figma.ink }}>
          Entropy
        </p>
        <p className="mt-1 text-[13px]" style={{ color: figma.muted }}>
          Starting…
        </p>
      </div>
    );
  } else if (!workspacePath) {
    content = (
      <div
        className="relative flex h-full flex-col"
        data-theme={initialSettings.theme}
        style={{ backgroundColor: figma.surface }}
      >
        <div className="absolute right-0 top-0 z-10">
          <WindowControls />
        </div>
        <WorkspaceSelector onSelect={(path) => void openWorkspace(path)} />
      </div>
    );
  } else {
    content = (
      <WorkspaceProvider
        key={`${workspacePath}:${libraryOnly ? "lib" : "ws"}`}
        path={workspacePath}
        initialSettings={initialSettings}
        initialSection={libraryOnly ? "inventory" : "notebook"}
        initialNotePath={libraryOnly ? null : pendingNotePath}
        onInitialNoteConsumed={() => setPendingNotePath(null)}
        onSettingsChange={(settings) => {
          setInitialSettings(settings);
          persistSession(libraryOnly ? null : workspacePath, settings);
        }}
        onClose={() => void closeWorkspace()}
        onOpenInWorkspace={(nextPath, notePath) => void switchWorkspace(nextPath, notePath)}
      >
        <WorkspaceShell
          needsNotebookWorkspace={libraryOnly}
          onPickWorkspace={(path) => void openWorkspace(path)}
        />
      </WorkspaceProvider>
    );
  }

  return <TooltipProvider delayDuration={400}>{content}</TooltipProvider>;
}
