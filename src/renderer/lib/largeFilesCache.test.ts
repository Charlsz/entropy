import { afterEach, describe, expect, it } from "vitest";
import {
  getLargeFilesCache,
  invalidateLargeFilesCache,
  largeFilesCacheKey,
  setLargeFilesCache,
  toLargeFileEntries,
} from "./largeFilesCache";

afterEach(() => {
  invalidateLargeFilesCache();
});

describe("large files cache", () => {
  it("orders roots so Home + an extra folder is the same key either way", () => {
    expect(largeFilesCacheKey(["D:\\Extra", "C:\\Users\\ada"])).toBe(
      largeFilesCacheKey(["C:\\Users\\ada\\", "d:/extra"]),
    );
  });

  it("maps scan hits into Library rows and drops the snapshot on invalidate", () => {
    const result = {
      files: [
        {
          path: "C:\\Users\\ada\\big.mov",
          name: "big.mov",
          size: 200,
          modifiedAt: 9,
          extension: ".mov",
        },
      ],
      totalBytes: 200,
      count: 1,
      truncated: false,
    };
    setLargeFilesCache({
      key: "home",
      result,
      entries: toLargeFileEntries(result),
    });
    expect(getLargeFilesCache()?.entries[0]).toMatchObject({
      path: "C:\\Users\\ada\\big.mov",
      isDirectory: false,
      size: 200,
    });
    invalidateLargeFilesCache();
    expect(getLargeFilesCache()).toBeNull();
  });
});
