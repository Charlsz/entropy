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
  inventoryTreemapCollapsed: boolean;
  libraryPerspective: "folders" | "gallery" | "large-files" | "duplicates";
  intelligenceView: "relationships" | "copilot" | null;
  uiDensity: "comfortable" | "default" | "compact";
  panelLayout: PanelLayoutState;
  inventoryPanelLayout: PanelLayoutState;
  inventoryExtraRoots: string[];
  /** Cached approximate bytes of ≥100MB files across Library roots. */
  largeFilesApproxBytes: number | null;
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

const DEFAULT_INVENTORY_PANEL_LAYOUT: PanelLayoutState = {
  sidebar: 0,
  main: 72,
  context: 28,
};

function normalizePerspective(
  value: string | undefined,
): AppSettings["libraryPerspective"] {
  if (
    value === "gallery" ||
    value === "large-files" ||
    value === "duplicates" ||
    value === "folders"
  ) {
    return value;
  }
  return "folders";
}

function normalizeIntelligence(
  value: string | null | undefined,
): AppSettings["intelligenceView"] {
  if (value === "relationships" || value === "copilot") return value;
  return null;
}

function normalizeDensity(value: string | undefined): AppSettings["uiDensity"] {
  if (value === "comfortable" || value === "compact" || value === "default") return value;
  return "default";
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  filesView: "list",
  sidebarCollapsed: false,
  contextCollapsed: false,
  inventoryTreemapCollapsed: true,
  libraryPerspective: "folders",
  intelligenceView: null,
  uiDensity: "default",
  panelLayout: { ...DEFAULT_PANEL_LAYOUT },
  inventoryPanelLayout: { ...DEFAULT_INVENTORY_PANEL_LAYOUT },
  inventoryExtraRoots: [],
  largeFilesApproxBytes: null,
};

function sessionPath(): string {
  return path.join(app.getPath("userData"), "session.json");
}

function normalizePanelLayout(
  value: unknown,
  fallback: PanelLayoutState = DEFAULT_PANEL_LAYOUT,
): PanelLayoutState {
  if (!value || typeof value !== "object") return { ...fallback };
  const record = value as Record<string, unknown>;
  return {
    sidebar: typeof record.sidebar === "number" ? record.sidebar : fallback.sidebar,
    main: typeof record.main === "number" ? record.main : fallback.main,
    context: typeof record.context === "number" ? record.context : fallback.context,
  };
}

export async function loadSession(): Promise<AppSession> {
  try {
    const raw = await fs.readFile(sessionPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSession>;
    return {
      lastWorkspace: typeof parsed.lastWorkspace === "string" ? parsed.lastWorkspace : null,
      settings: {
        theme: parsed.settings?.theme === "dark" ? "dark" : "light",
        filesView: parsed.settings?.filesView === "grid" ? "grid" : "list",
        sidebarCollapsed: Boolean(parsed.settings?.sidebarCollapsed),
        contextCollapsed: Boolean(parsed.settings?.contextCollapsed),
        // Storage map is opt-in; never restore an open panel from a previous session.
        inventoryTreemapCollapsed: true,
        libraryPerspective: normalizePerspective(
          (parsed.settings as { libraryPerspective?: string } | undefined)?.libraryPerspective,
        ),
        intelligenceView: normalizeIntelligence(
          (parsed.settings as { intelligenceView?: string | null } | undefined)?.intelligenceView,
        ),
        uiDensity: normalizeDensity(
          (parsed.settings as { uiDensity?: string } | undefined)?.uiDensity,
        ),
        panelLayout: normalizePanelLayout(parsed.settings?.panelLayout),
        inventoryPanelLayout: normalizePanelLayout(
          parsed.settings?.inventoryPanelLayout,
          DEFAULT_INVENTORY_PANEL_LAYOUT,
        ),
        inventoryExtraRoots: Array.isArray(parsed.settings?.inventoryExtraRoots)
          ? parsed.settings.inventoryExtraRoots.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        largeFilesApproxBytes:
          typeof (parsed.settings as { largeFilesApproxBytes?: unknown } | undefined)
            ?.largeFilesApproxBytes === "number"
            ? Math.max(
                0,
                Math.floor(
                  (parsed.settings as { largeFilesApproxBytes: number }).largeFilesApproxBytes,
                ),
              )
            : null,
      },
    };
  } catch {
    return {
      lastWorkspace: null,
      settings: {
        ...DEFAULT_SETTINGS,
        panelLayout: { ...DEFAULT_PANEL_LAYOUT },
        inventoryPanelLayout: { ...DEFAULT_INVENTORY_PANEL_LAYOUT },
        inventoryExtraRoots: [],
      },
    };
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
