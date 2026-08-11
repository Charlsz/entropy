import { app, dialog, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { RecentWorkspace } from "../shared/types";

const MAX_RECENT = 12;

function recentFilePath(): string {
  return path.join(app.getPath("userData"), "recent-workspaces.json");
}

async function readRecent(): Promise<RecentWorkspace[]> {
  try {
    const raw = await fs.readFile(recentFilePath(), "utf8");
    const parsed = JSON.parse(raw) as RecentWorkspace[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecent(items: RecentWorkspace[]): Promise<void> {
  await fs.mkdir(path.dirname(recentFilePath()), { recursive: true });
  await fs.writeFile(recentFilePath(), JSON.stringify(items, null, 2), "utf8");
}

export async function getRecentWorkspaces(): Promise<RecentWorkspace[]> {
  const items = await readRecent();
  const existing: RecentWorkspace[] = [];

  for (const item of items) {
    try {
      const stat = await fs.stat(item.path);
      if (stat.isDirectory()) {
        existing.push(item);
      }
    } catch {
      // Drop missing folders.
    }
  }

  if (existing.length !== items.length) {
    await writeRecent(existing);
  }

  return existing;
}

export async function rememberWorkspace(workspacePath: string): Promise<void> {
  await ensureWorkspaceMarker(workspacePath);
  const items = await readRecent();
  const next: RecentWorkspace = {
    path: workspacePath,
    name: path.basename(workspacePath),
    openedAt: Date.now(),
  };

  const filtered = items.filter((item) => item.path !== workspacePath);
  filtered.unshift(next);
  await writeRecent(filtered.slice(0, MAX_RECENT));
}

/** Marker folder Entropy uses to recognize Notebook workspaces. */
export async function ensureWorkspaceMarker(workspacePath: string): Promise<void> {
  const marker = path.join(path.normalize(workspacePath), ".entropy");
  await fs.mkdir(marker, { recursive: true });
}

export async function isEntropyWorkspace(workspacePath: string): Promise<boolean> {
  try {
    const info = await fs.stat(path.join(path.normalize(workspacePath), ".entropy"));
    return info.isDirectory();
  } catch {
    return false;
  }
}

/** Recent folders that still have an Entropy workspace marker. */
export async function listMarkedWorkspaces(): Promise<RecentWorkspace[]> {
  const recent = await getRecentWorkspaces();
  const marked: RecentWorkspace[] = [];
  for (const item of recent) {
    if (await isEntropyWorkspace(item.path)) marked.push(item);
  }
  return marked;
}

export async function removeRecentWorkspace(workspacePath: string): Promise<void> {
  const items = await readRecent();
  await writeRecent(items.filter((item) => item.path !== workspacePath));
}

export async function clearRecentWorkspaces(): Promise<void> {
  await writeRecent([]);
}

export async function renameWorkspace(
  workspacePath: string,
  newName: string,
): Promise<string> {
  const clean = newName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/[. ]+$/g, "");
  if (!clean) {
    throw new Error("Enter a workspace name.");
  }

  const normalized = path.normalize(workspacePath);
  const parent = path.dirname(normalized);
  const target = path.join(parent, clean);

  if (path.resolve(target) === path.resolve(normalized)) {
    return normalized;
  }

  try {
    await fs.access(target);
    throw new Error("A folder with that name already exists.");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if ((error as Error).message === "A folder with that name already exists.") throw error;
    if (code && code !== "ENOENT") throw error;
  }

  await fs.rename(normalized, target);

  const items = await readRecent();
  const filtered = items.filter((item) => {
    const resolved = path.resolve(item.path);
    return resolved !== path.resolve(normalized) && resolved !== path.resolve(target);
  });
  filtered.unshift({ path: target, name: clean, openedAt: Date.now() });
  await writeRecent(filtered.slice(0, MAX_RECENT));

  return target;
}

async function showDirectoryDialog(
  browserWindow: BrowserWindow | null,
  title: string,
): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    title,
    properties: ["openDirectory", "createDirectory"],
  };

  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

export async function openWorkspaceDialog(
  browserWindow: BrowserWindow | null,
): Promise<string | null> {
  const selected = await showDirectoryDialog(browserWindow, "Open Workspace");
  if (!selected) {
    return null;
  }

  await rememberWorkspace(selected);
  return selected;
}

export async function createWorkspaceDialog(
  browserWindow: BrowserWindow | null,
): Promise<string | null> {
  const parentDir = await showDirectoryDialog(
    browserWindow,
    "Choose a location for the new workspace",
  );

  if (!parentDir) {
    return null;
  }

  const baseName = `Workspace ${new Date().toISOString().slice(0, 10)}`;
  let workspacePath = path.join(parentDir, baseName);
  let suffix = 1;

  while (true) {
    try {
      await fs.access(workspacePath);
      suffix += 1;
      workspacePath = path.join(parentDir, `${baseName} ${suffix}`);
    } catch {
      break;
    }
  }

  await fs.mkdir(workspacePath, { recursive: true });
  await rememberWorkspace(workspacePath);
  return workspacePath;
}
