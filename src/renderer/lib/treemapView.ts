import type { TreemapFileLeaf } from "../../shared/types";
import { isAggregateLeaf } from "../../shared/treemapLeaves";
import { squarify } from "./squarify";

export const MIN_TILE_EDGE = 16;

export interface TreemapLayoutCell extends TreemapFileLeaf {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Place tiles in the frame without expanding them past the squarify rect (no overlap). */
export function layoutTreemapTiles(
  files: TreemapFileLeaf[],
  total: number,
  width: number,
  height: number,
  gap = 1,
): TreemapLayoutCell[] {
  if (files.length === 0 || total <= 0 || width < MIN_TILE_EDGE || height < MIN_TILE_EDGE) {
    return [];
  }

  const frameArea = Math.max(width * height, 1);
  const floor = Math.max(1, Math.floor((total * (MIN_TILE_EDGE * MIN_TILE_EDGE)) / frameArea));
  const rects = squarify(
    files.map((file) => ({
      id: file.path,
      size: Math.max(file.size, floor),
    })),
    0,
    0,
    width,
    height,
  );
  const byPath = new Map(files.map((file) => [file.path, file]));

  return rects
    .map((rect) => {
      const file = byPath.get(rect.id);
      if (!file) return null;
      return {
        ...file,
        x: rect.x + gap / 2,
        y: rect.y + gap / 2,
        width: Math.max(0, rect.width - gap),
        height: Math.max(0, rect.height - gap),
      };
    })
    .filter((item): item is TreemapLayoutCell => item != null && item.width > 0 && item.height > 0);
}

export function tilesOverlap(a: TreemapLayoutCell, b: TreemapLayoutCell, slop = 0.5): boolean {
  return (
    a.x + slop < b.x + b.width &&
    a.x + a.width > b.x + slop &&
    a.y + slop < b.y + b.height &&
    a.y + a.height > b.y + slop
  );
}

export function hoverCardPosition(
  x: number,
  y: number,
  frameWidth: number,
  frameHeight: number,
  cardWidth: number,
  cardHeight: number,
): { left: number; top: number } {
  const left = Math.min(Math.max(8, x + 12), Math.max(8, frameWidth - cardWidth - 8));
  const top = Math.min(Math.max(8, y + 12), Math.max(8, frameHeight - cardHeight - 8));
  return { left, top };
}

export function treemapHoverMeta(leaf: TreemapFileLeaf): {
  kindKey: "folder" | TreemapFileLeaf["kind"];
  location: string | null;
  modifiedAt: number | null;
} {
  return {
    kindKey: leaf.isDirectory ? "folder" : leaf.kind,
    location: leaf.location && !isAggregateLeaf(leaf) ? leaf.location : null,
    modifiedAt: leaf.modifiedAt && leaf.modifiedAt > 0 ? leaf.modifiedAt : null,
  };
}
