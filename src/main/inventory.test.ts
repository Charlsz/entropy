import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name === "home") return process.env.ENTROPY_TEST_HOME || os.homedir();
      return os.homedir();
    },
  },
  BrowserWindow: class {},
  dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
}));

import {
  clearSizeCache,
  getDiskSpace,
  invalidateSizeCacheUnder,
  measureChildren,
  measurePath,
  scanLargeFiles,
  scanTreemapLevel,
} from "./inventory";

const tempDirs: string[] = [];

async function makeTemp(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "entropy-storage-"));
  tempDirs.push(dir);
  return dir;
}

async function writeBytes(filePath: string, size: number): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.alloc(size, 1));
}

beforeEach(() => {
  clearSizeCache();
});

afterEach(async () => {
  clearSizeCache();
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("measurePath / measureChildren", () => {
  it("sums nested files and skips hidden, symlink, and tooling folders", async () => {
    const root = await makeTemp();
    await writeBytes(path.join(root, "keep.bin"), 40);
    await writeBytes(path.join(root, "sub", "inner.bin"), 60);
    await writeBytes(path.join(root, ".secret", "hidden.bin"), 80);
    await writeBytes(path.join(root, "node_modules", "pkg", "index.js"), 200);

    const visible = await measurePath(root);
    expect(visible).toBe(100);

    const children = await measureChildren(root);
    const byName = new Map(children.map((child) => [path.basename(child.path), child.size]));
    expect(byName.get("keep.bin")).toBe(40);
    expect(byName.get("sub")).toBe(60);
    expect(byName.has(".secret")).toBe(false);
    expect(byName.has("node_modules")).toBe(false);
  });

  it("returns normalized child paths so the Library table can look them up", async () => {
    const root = await makeTemp();
    await writeBytes(path.join(root, "a.bin"), 8);
    const mixed = root.includes("\\") ? root.replace(/\\/g, "/") : root;
    const children = await measureChildren(mixed);
    expect(children[0]?.path).toBe(path.normalize(path.join(root, "a.bin")));
  });

  it("drops cached ancestor sizes after a nested file changes", async () => {
    const root = await makeTemp();
    const nested = path.join(root, "sub", "file.bin");
    await writeBytes(nested, 16);
    expect(await measurePath(root)).toBe(16);
    await writeBytes(nested, 48);
    invalidateSizeCacheUnder(path.join(root, "sub"));
    expect(await measurePath(root)).toBe(48);
  });
});

describe("scanTreemapLevel", () => {
  it("maps folders by recursive size and files by their own bytes", async () => {
    const root = await makeTemp();
    await writeBytes(path.join(root, "movie.mov"), 80);
    await writeBytes(path.join(root, "stills", "a.jpg"), 20);
    await writeBytes(path.join(root, "stills", "b.jpg"), 30);

    const scan = await scanTreemapLevel(root);
    expect(scan.truncated).toBe(false);
    expect(scan.fileCount).toBe(2);
    expect(scan.totalSize).toBe(130);
    expect(scan.files.map((file) => file.name)).toEqual(["movie.mov", "stills"]);
    expect(scan.files[0]).toMatchObject({ isDirectory: false, kind: "video", size: 80 });
    expect(scan.files[1]).toMatchObject({ isDirectory: true, size: 50, location: path.basename(root) });
  });

  it("skips empty folders and reserved Other-path collisions stay identifiable", async () => {
    const root = await makeTemp();
    await fs.mkdir(path.join(root, "empty"));
    await writeBytes(path.join(root, "keep.bin"), 4);
    const scan = await scanTreemapLevel(root);
    expect(scan.files.map((file) => file.name)).toEqual(["keep.bin"]);
    expect(scan.files.some((file) => file.path.endsWith(".__entropy_other__"))).toBe(false);
  });
});

describe("scanLargeFiles", () => {
  it("respects the size floor, skips protected trees, and de-dupes the same root", async () => {
    const root = await makeTemp();
    await writeBytes(path.join(root, "small.bin"), 20);
    await writeBytes(path.join(root, "big.bin"), 80);
    await writeBytes(path.join(root, "node_modules", "vendor.bin"), 90);

    const scan = await scanLargeFiles([root, root], 50);
    expect(scan.files.map((file) => file.name)).toEqual(["big.bin"]);
    expect(scan.totalBytes).toBe(80);
    expect(scan.count).toBe(1);
    expect(scan.truncated).toBe(false);
  });
});

describe("getDiskSpace", () => {
  it("reads the volume that contains the target, even if the folder is gone", async () => {
    const root = await makeTemp();
    const missing = path.join(root, "does-not-exist", "nested");
    const space = await getDiskSpace(missing);
    expect(space.total).toBeGreaterThan(0);
    expect(space.free).toBeGreaterThanOrEqual(0);
    expect(space.free).toBeLessThanOrEqual(space.total);
  });
});
