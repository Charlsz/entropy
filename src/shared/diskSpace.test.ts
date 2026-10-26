import { describe, expect, it } from "vitest";
import {
  collectDiskSpaceProbes,
  occupiedDiskRatio,
  storageFillTone,
  volumeLabel,
  volumeSpaceFromStatfs,
} from "./diskSpace";

describe("volumeSpaceFromStatfs", () => {
  it("multiplies blocks by the reported block size", () => {
    expect(
      volumeSpaceFromStatfs({
        bsize: 4096,
        blocks: 1000,
        bavail: 250,
        bfree: 300,
      }),
    ).toEqual({ free: 250 * 4096, total: 1000 * 4096 });
  });

  it("prefers bytes available to unprivileged callers", () => {
    const space = volumeSpaceFromStatfs({
      bsize: 512,
      blocks: 20,
      bavail: 2,
      bfree: 8,
    });
    expect(space?.free).toBe(2 * 512);
  });

  it("rejects empty or non-finite volumes", () => {
    expect(volumeSpaceFromStatfs({ bsize: 4096, blocks: 0, bavail: 0 })).toBeNull();
    expect(volumeSpaceFromStatfs({ bsize: Number.NaN, blocks: 10, bavail: 1 })).toEqual({
      free: 4096,
      total: 10 * 4096,
    });
  });
});

describe("occupiedDiskRatio", () => {
  it("clamps used bytes into 0..1", () => {
    expect(occupiedDiskRatio(25, 100)).toBe(0.75);
    expect(occupiedDiskRatio(0, 100)).toBe(1);
    expect(occupiedDiskRatio(100, 100)).toBe(0);
    expect(occupiedDiskRatio(150, 100)).toBe(0);
  });

  it("stays empty when the volume is unknown", () => {
    expect(occupiedDiskRatio(10, 0)).toBe(0);
    expect(occupiedDiskRatio(Number.NaN, 100)).toBe(0);
    expect(occupiedDiskRatio(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("storageFillTone", () => {
  it("stays in the ink/accent family as the disk fills", () => {
    expect(storageFillTone(0.2)).toBe("accent-muted");
    expect(storageFillTone(0.5)).toBe("accent");
    expect(storageFillTone(0.75)).toBe("ink-accent");
    expect(storageFillTone(0.9)).toBe("ink");
  });
});

describe("volumeLabel", () => {
  it("shows the Windows drive of the open folder", () => {
    expect(volumeLabel("D:\\Photos\\raw", "win32")).toBe("D:");
    expect(volumeLabel("c:/Users/ada", "win32")).toBe("C:");
    expect(volumeLabel("/Users/ada", "darwin")).toBeNull();
    expect(volumeLabel(null, "win32")).toBeNull();
  });
});

describe("collectDiskSpaceProbes", () => {
  it("walks from a missing folder to the volume root, then Home", () => {
    expect(collectDiskSpaceProbes("D:\\Photos\\gone\\nested", "C:\\Users\\ada")).toEqual([
      "D:\\Photos\\gone\\nested",
      "D:\\Photos\\gone",
      "D:\\Photos",
      "D:\\",
      "C:\\Users\\ada",
    ]);
  });

  it("does not repeat Home when the probe already is Home", () => {
    expect(collectDiskSpaceProbes("C:\\Users\\ada", "C:\\Users\\ada")).toEqual([
      "C:\\Users\\ada",
      "C:\\Users",
      "C:\\",
    ]);
  });
});
