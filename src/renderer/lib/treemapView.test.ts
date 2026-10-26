import { describe, expect, it } from "vitest";
import type { TreemapFileLeaf } from "../../shared/types";
import { hoverCardPosition, layoutTreemapTiles, tilesOverlap, treemapHoverMeta } from "./treemapView";

function leaf(partial: Partial<TreemapFileLeaf> & Pick<TreemapFileLeaf, "path" | "size">): TreemapFileLeaf {
  return {
    name: partial.name ?? partial.path,
    extension: partial.extension ?? "",
    kind: partial.kind ?? "other",
    isDirectory: partial.isDirectory ?? false,
    ...partial,
  };
}

describe("treemap tile layout", () => {
  it("keeps tiles inside the frame and does not overlap them", () => {
    const files = [
      leaf({ path: "big", size: 800, kind: "video" }),
      leaf({ path: "mid", size: 150, kind: "image" }),
      leaf({ path: "tiny", size: 1, kind: "other" }),
    ];
    const cells = layoutTreemapTiles(files, 951, 200, 120);
    expect(cells).toHaveLength(3);
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(-0.01);
      expect(cell.y).toBeGreaterThanOrEqual(-0.01);
      expect(cell.x + cell.width).toBeLessThanOrEqual(200.01);
      expect(cell.y + cell.height).toBeLessThanOrEqual(120.01);
    }
    expect(tilesOverlap(cells[0]!, cells[1]!)).toBe(false);
    expect(tilesOverlap(cells[0]!, cells[2]!)).toBe(false);
    expect(tilesOverlap(cells[1]!, cells[2]!)).toBe(false);
  });

  it("returns nothing until the frame is large enough to draw", () => {
    expect(layoutTreemapTiles([leaf({ path: "a", size: 10 })], 10, 8, 200)).toEqual([]);
  });
});

describe("treemap hover", () => {
  it("keeps the card inside the frame near a corner", () => {
    const pos = hoverCardPosition(190, 110, 200, 120, 132, 72);
    expect(pos.left + 132).toBeLessThanOrEqual(200);
    expect(pos.top + 72).toBeLessThanOrEqual(120);
  });

  it("exposes parent folder and modified time for hover intel", () => {
    expect(
      treemapHoverMeta(
        leaf({
          path: "/Users/ada/Photos/raw.dng",
          name: "raw.dng",
          size: 12,
          kind: "image",
          location: "Photos",
          modifiedAt: 1_700_000_000_000,
        }),
      ),
    ).toEqual({
      kindKey: "image",
      location: "Photos",
      modifiedAt: 1_700_000_000_000,
    });
  });
});
