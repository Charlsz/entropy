import { describe, expect, it } from "vitest";
import { capTreemapLeaves, isAggregateLeaf, otherLeafPath } from "./treemapLeaves";

describe("treemap leaf capping", () => {
  it("keeps every sibling when the map is small enough", () => {
    const collected = [
      { path: "a", size: 8 },
      { path: "b", size: 2 },
    ];
    expect(capTreemapLeaves(collected, 8, () => ({ path: "other", size: 0 }))).toEqual({
      files: collected,
      truncated: false,
    });
  });

  it("folds the tail into one Other leaf and preserves the leftover bytes", () => {
    const collected = [
      { path: "a", size: 50 },
      { path: "b", size: 40 },
      { path: "c", size: 9 },
      { path: "d", size: 1 },
    ];
    const capped = capTreemapLeaves(collected, 3, (rest, restSize) => ({
      path: "other",
      size: restSize,
      count: rest.length,
    }));
    expect(capped.truncated).toBe(true);
    expect(capped.files.map((file) => file.path)).toEqual(["a", "b", "other"]);
    expect(capped.files[2]).toMatchObject({ size: 10, count: 2 });
  });
});

describe("aggregate leaf identity", () => {
  it("recognizes the reserved Other path on both separators", () => {
    expect(isAggregateLeaf({ path: otherLeafPath("D:\\Photos"), name: "x" })).toBe(true);
    expect(isAggregateLeaf({ path: otherLeafPath("/Users/ada"), name: "x" })).toBe(true);
    expect(isAggregateLeaf({ path: "/Users/ada/Other (2 items)", name: "Other (2 items)" })).toBe(
      true,
    );
    expect(isAggregateLeaf({ path: "/Users/ada/movie.mov", name: "movie.mov" })).toBe(false);
  });
});
