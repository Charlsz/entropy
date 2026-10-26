import { describe, expect, it } from "vitest";
import { squarify } from "./squarify";

describe("squarify", () => {
  it("fills the frame for a single leaf", () => {
    expect(squarify([{ id: "only", size: 10 }], 0, 0, 100, 50)).toEqual([
      { id: "only", size: 10, x: 0, y: 0, width: 100, height: 50 },
    ]);
  });

  it("drops empty sizes and empty frames", () => {
    expect(squarify([{ id: "z", size: 0 }], 0, 0, 100, 50)).toEqual([]);
    expect(squarify([{ id: "a", size: 4 }], 0, 0, 0, 50)).toEqual([]);
  });

  it("preserves area across the row and sorts largest first", () => {
    const rects = squarify(
      [
        { id: "small", size: 10 },
        { id: "big", size: 90 },
      ],
      0,
      0,
      100,
      100,
    );
    expect(rects.map((rect) => rect.id)).toEqual(["big", "small"]);
    const area = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
    expect(area).toBeCloseTo(10_000, 5);
  });
});
