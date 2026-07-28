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
  sidebar: 22,
  main: 58,
  context: 20,
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

export async function saveSession(session: AppSession): Promise<void> {
  const filePath = sessionPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.session.${process.pid}.tmp`);
  const payload = JSON.stringify(session, null, 2);
  try {
    await fs.writeFile(tempPath, payload, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore.
    }
    throw error;
  }
}

export { DEFAULT_SETTINGS, DEFAULT_PANEL_LAYOUT };
