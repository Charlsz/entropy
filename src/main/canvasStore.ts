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
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  const payload = JSON.stringify(doc, null, 2);

  try {
    await fs.writeFile(tempPath, payload, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup failures.
    }
    throw error;
  }
}
