import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bytesUntilCap, planUndo, trashInfoPath } from "./undoPolicy";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "entropy-undo-"));
  tempDirs.push(dir);
  return dir;
}

describe("undo plan", () => {
  it("restores from cache only when the original path is free", () => {
    expect(planUndo(false, true)).toEqual({ action: "restore-cache" });
  });

  it("keeps the cache when a different file already occupies the path", () => {
    expect(planUndo(true, true)).toEqual({ action: "fail", dropCache: false });
  });

  it("counts a path with nothing left to restore as already back", () => {
    expect(planUndo(true, false)).toEqual({ action: "count-restored" });
    expect(planUndo(false, false)).toEqual({ action: "try-system-trash" });
  });
});

describe("trash info paths", () => {
  it("reads the original path and does not fall back to a bare name", () => {
    const body = "[Trash Info]\nPath=/home/ada/notes/a.md\nDeletionDate=2026-01-01T00:00:00\n";
    expect(trashInfoPath(body)).toBe("/home/ada/notes/a.md");
    expect(trashInfoPath("Path=" + encodeURIComponent("/home/ada/my notes/a.md"))).toBe(
      "/home/ada/my notes/a.md",
    );
    expect(trashInfoPath("no path here")).toBeNull();
  });
});

describe("undo copy budget", () => {
  it("counts a small tree and refuses one past the cap", async () => {
    const dir = await tempDir();
    await fs.writeFile(path.join(dir, "a.txt"), "12345");
    const nested = path.join(dir, "nested");
    await fs.mkdir(nested);
    await fs.writeFile(path.join(nested, "b.txt"), "123");
    expect(await bytesUntilCap(dir, 10)).toBe(8);
    expect(await bytesUntilCap(dir, 7)).toBeNull();
    expect(await bytesUntilCap(path.join(dir, "a.txt"), 5)).toBe(5);
    expect(await bytesUntilCap(path.join(dir, "a.txt"), 4)).toBeNull();
  });
});
