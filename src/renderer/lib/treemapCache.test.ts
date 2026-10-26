import { afterEach, describe, expect, it } from "vitest";
import {
  getTreemapCache,
  invalidateTreemapCache,
  setTreemapCache,
  treemapCacheKey,
} from "./treemapCache";

afterEach(() => {
  invalidateTreemapCache();
});

describe("treemap cache", () => {
  it("treats trailing slashes and case as the same folder on a cache key", () => {
    expect(treemapCacheKey("D:\\Photos\\")).toBe(treemapCacheKey("d:/photos"));
  });

  it("clears the last scan so a disk change can rematerialize the map", () => {
    setTreemapCache({
      folderKey: "d:\\photos",
      scan: { files: [], totalSize: 0, fileCount: 0, truncated: false },
    });
    expect(getTreemapCache()?.folderKey).toBe("d:\\photos");
    invalidateTreemapCache();
    expect(getTreemapCache()).toBeNull();
  });
});
