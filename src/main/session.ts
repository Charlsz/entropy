import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export interface PanelLayoutState {
  sidebar: number;
  main: number;
  context: number;
}

export interface AppSettings {
  theme: "dark" | "light";
  filesView: "list" | "grid";
  sidebarCollapsed: boolean;
  contextCollapsed: boolean;
  panelLayout: PanelLayoutState;
}

export interface AppSession {
  lastWorkspace: string | null;
  settings: AppSettings;
}

const DEFAULT_PANEL_LAYOUT: PanelLayoutState = {
  sidebar: 16,
  main: 66,
  context: 18,
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  filesView: "grid",
  sidebarCollapsed: false,
  contextCollapsed: false,
  panelLayout: { ...DEFAULT_PANEL_LAYOUT },
};

function sessionPath(): string {
  return path.join(app.getPath("userData"), "session.json");
}

function normalizePanelLayout(value: unknown): PanelLayoutState {
  if (!value || typeof value !== "object") return { ...DEFAULT_PANEL_LAYOUT };
  const record = value as Record<string, unknown>;
  return {
    sidebar: typeof record.sidebar === "number" ? record.sidebar : DEFAULT_PANEL_LAYOUT.sidebar,
    main: typeof record.main === "number" ? record.main : DEFAULT_PANEL_LAYOUT.main,
    context: typeof record.context === "number" ? record.context : DEFAULT_PANEL_LAYOUT.context,
  };
}

export async function loadSession(): Promise<AppSession> {
  try {
    const raw = await fs.readFile(sessionPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSession>;
    return {
      lastWorkspace: typeof parsed.lastWorkspace === "string" ? parsed.lastWorkspace : null,
      settings: {
        theme: parsed.settings?.theme === "light" ? "light" : "dark",
        filesView: parsed.settings?.filesView === "list" ? "list" : "grid",
        sidebarCollapsed: Boolean(parsed.settings?.sidebarCollapsed),
        contextCollapsed: Boolean(parsed.settings?.contextCollapsed),
        panelLayout: normalizePanelLayout(parsed.settings?.panelLayout),
      },
    };
  } catch {
    return { lastWorkspace: null, settings: { ...DEFAULT_SETTINGS, panelLayout: { ...DEFAULT_PANEL_LAYOUT } } };
  }
}

/** Serialize + coalesce concurrent saves so temp rename races cannot ENOENT. */
let saveQueue: Promise<void> = Promise.resolve();
let latestSession: AppSession | null = null;

export function saveSession(session: AppSession): Promise<void> {
  latestSession = session;
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(async () => {
      if (!latestSession) return;
      const toWrite = latestSession;
      latestSession = null;
      await writeSessionAtomic(toWrite);
    });
  return saveQueue;
}

async function writeSessionAtomic(session: AppSession): Promise<void> {
  const filePath = sessionPath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = path.join(
    dir,
    `.session.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`,
  );
  const payload = JSON.stringify(session, null, 2);

  try {
    await fs.writeFile(tempPath, payload, "utf8");
    try {
      await fs.rename(tempPath, filePath);
    } catch {
      // Windows can fail rename when the destination is locked; copy then unlink.
      await fs.copyFile(tempPath, filePath);
      await fs.unlink(tempPath).catch(() => undefined);
    }
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export { DEFAULT_SETTINGS, DEFAULT_PANEL_LAYOUT };
