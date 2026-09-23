import { describe, expect, it } from "vitest";
import { collapseHardLinks, groupBySize } from "./scanner";
import type { ScannedFile } from "./types";

function file(partial: Partial<ScannedFile> & Pick<ScannedFile, "path" | "size">): ScannedFile {
  return {
    name: partial.path.split(/[/\\]/).pop() ?? partial.path,
    mtimeMs: 1,
    ctimeMs: 1,
    dev: 1,
    ino: null,
    extension: "",
    ...partial,
  };
}

describe("duplicate grouping", () => {
  it("drops sizes that only appear once", () => {
    const groups = groupBySize([
      file({ path: "a", size: 10, ino: 1 }),
      file({ path: "b", size: 10, ino: 2 }),
      file({ path: "c", size: 99, ino: 3 }),
    ]);
    expect(groups.size).toBe(1);
    expect(groups.get(10)?.map((item) => item.path)).toEqual(["a", "b"]);
  });

  it("keeps one path per hard link", () => {
    const kept = collapseHardLinks([
      file({ path: "a", size: 10, dev: 1, ino: 7 }),
      file({ path: "b", size: 10, dev: 1, ino: 7 }),
      file({ path: "c", size: 10, dev: 1, ino: 8 }),
    ]);
    expect(kept.map((item) => item.path)).toEqual(["a", "c"]);
  });
});
