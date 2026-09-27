import { describe, expect, it } from "vitest";
import { sizeCacheKeyMatchesChange } from "./sizeCacheInvalidate";

describe("folder size cache invalidation", () => {
  it("drops the changed folder, its descendants, and its ancestors", () => {
    expect(sizeCacheKeyMatchesChange("C:\\Users\\me", "C:\\Users\\me\\Desktop")).toBe(true);
    expect(sizeCacheKeyMatchesChange("C:\\Users\\me\\Desktop\\photos", "C:\\Users\\me\\Desktop")).toBe(
      true,
    );
    expect(sizeCacheKeyMatchesChange("C:\\Users\\me\\Desktop", "C:\\Users\\me\\Desktop")).toBe(true);
  });

  it("keeps a sibling folder", () => {
    expect(sizeCacheKeyMatchesChange("C:\\Users\\me-backup", "C:\\Users\\me\\Desktop")).toBe(false);
    expect(sizeCacheKeyMatchesChange("D:\\Users\\me", "C:\\Users\\me\\Desktop")).toBe(false);
  });
});
