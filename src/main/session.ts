import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export interface AppSettings {
  theme: "dark" | "light";
  filesView: "list" | "grid";
}

export interface AppSession {
  lastWorkspace: string | null;
  settings: AppSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  filesView: "grid",
};

function sessionPath(): string {
  return path.join(app.getPath("userData"), "session.json");
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
      },
    };
  } catch {
    return { lastWorkspace: null, settings: { ...DEFAULT_SETTINGS } };
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

export { DEFAULT_SETTINGS };
