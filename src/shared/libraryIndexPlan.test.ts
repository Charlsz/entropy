import { describe, expect, it } from "vitest";
import { indexCoversChange, libraryIndexNeedsBuild } from "./libraryIndexPlan";

describe("library index rebuild plan", () => {
  it("rebuilds a missing or stale index and waits out an in-flight walk", () => {
    expect(libraryIndexNeedsBuild({ hasSnapshot: false, stale: false, building: false })).toBe(true);
    expect(libraryIndexNeedsBuild({ hasSnapshot: true, stale: true, building: false })).toBe(true);
    expect(libraryIndexNeedsBuild({ hasSnapshot: true, stale: false, building: false })).toBe(false);
    expect(libraryIndexNeedsBuild({ hasSnapshot: true, stale: true, building: true })).toBe(false);
  });

  it("does not tight-loop after a failed walk", () => {
    expect(
      libraryIndexNeedsBuild(
        { hasSnapshot: true, stale: true, building: false, retryAfter: 5_000 },
        1_000,
      ),
    ).toBe(false);
    expect(
      libraryIndexNeedsBuild(
        { hasSnapshot: true, stale: true, building: false, retryAfter: 5_000 },
        5_000,
      ),
    ).toBe(true);
  });

  it("matches a change under a root without matching a sibling prefix", () => {
    expect(indexCoversChange("c:\\users\\ada", "c:\\users\\ada\\notes\\a.md")).toBe(true);
    expect(indexCoversChange("c:\\users\\ada", "c:\\users\\ada-backup\\a.md")).toBe(false);
    expect(indexCoversChange("c:", "c:\\users\\ada\\a.md")).toBe(true);
    expect(indexCoversChange("/home/ada", "/home/ada/notes")).toBe(true);
    expect(indexCoversChange("/home/ada", "/home/ada-backup")).toBe(false);
  });
});
