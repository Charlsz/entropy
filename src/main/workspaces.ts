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

export async function removeRecentWorkspace(workspacePath: string): Promise<void> {
  const items = await readRecent();
  await writeRecent(items.filter((item) => item.path !== workspacePath));
}

export async function clearRecentWorkspaces(): Promise<void> {
  await writeRecent([]);
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
