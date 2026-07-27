import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export interface PersistedCanvas {
  version: 1;
  workspacePath: string;
  camera: { x: number; y: number; scale: number };
  objects: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    path: string;
    title: string;
    text?: string;
  }>;
  connections: Array<{
    id: string;
    fromId: string;
    toId: string;
  }>;
}

function canvasFileFor(workspacePath: string): string {
  const hash = createHash("sha1").update(workspacePath).digest("hex").slice(0, 16);
  return path.join(app.getPath("userData"), "canvases", `${hash}.json`);
}

export async function loadCanvas(workspacePath: string): Promise<PersistedCanvas | null> {
  try {
    const raw = await fs.readFile(canvasFileFor(workspacePath), "utf8");
    return JSON.parse(raw) as PersistedCanvas;
  } catch {
    return null;
  }
}

export async function saveCanvas(doc: PersistedCanvas): Promise<void> {
  const filePath = canvasFileFor(doc.workspacePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(doc, null, 2), "utf8");
}
