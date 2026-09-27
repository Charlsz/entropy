import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeTextIfMtimeMatches } from "./textWrite";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("conditional note write", () => {
  it("refuses a stale mtime and leaves the file untouched", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "entropy-write-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "note.md");
    await fs.writeFile(filePath, "hello");
    const info = await fs.stat(filePath);

    const denied = await writeTextIfMtimeMatches(filePath, "nope", info.mtimeMs - 10_000);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe("conflict");
    expect(await fs.readFile(filePath, "utf8")).toBe("hello");

    const saved = await writeTextIfMtimeMatches(filePath, "world", info.mtimeMs);
    expect(saved.ok).toBe(true);
    expect(await fs.readFile(filePath, "utf8")).toBe("world");
  });

  it("reports a missing file instead of creating one", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "entropy-write-"));
    tempDirs.push(dir);
    const result = await writeTextIfMtimeMatches(path.join(dir, "missing.md"), "x", 1);
    expect(result).toEqual({ ok: false, reason: "missing", mtimeMs: null });
  });
});
