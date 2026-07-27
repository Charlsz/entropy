export type CanvasObjectType =
  | "note"
  | "image"
  | "video"
  | "pdf"
  | "folder"
  | "text"
  | "file";

export interface CanvasObject {
  id: string;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Absolute filesystem path for referenced files; empty for text cards. */
  path: string;
  title: string;
  text?: string;
}

export interface CanvasConnection {
  id: string;
  fromId: string;
  toId: string;
}

export interface CanvasDocument {
  version: 1;
  camera: { x: number; y: number; scale: number };
  objects: CanvasObject[];
  connections: CanvasConnection[];
}

export function createEmptyCanvas(): CanvasDocument {
  return {
    version: 1,
    camera: { x: 0, y: 0, scale: 1 },
    objects: [],
    connections: [],
  };
}

export function detectCanvasType(entry: {
  isDirectory: boolean;
  extension: string;
  name: string;
}): CanvasObjectType {
  if (entry.isDirectory) return "folder";
  const ext = entry.extension.toLowerCase();
  if (ext === ".md") return "note";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].includes(ext)) return "image";
  if ([".mp4", ".webm", ".ogg", ".mov", ".mkv"].includes(ext)) return "video";
  if (ext === ".pdf") return "pdf";
  return "file";
}

export function defaultSize(type: CanvasObjectType): { width: number; height: number } {
  switch (type) {
    case "image":
    case "video":
    case "pdf":
      return { width: 280, height: 200 };
    case "note":
      return { width: 240, height: 160 };
    case "folder":
      return { width: 200, height: 100 };
    case "text":
      return { width: 220, height: 120 };
    default:
      return { width: 200, height: 110 };
  }
}
