import { describe, expect, it } from "vitest";
import { searchSnapshot, type LibraryIndexSnapshot } from "./libraryIndexQuery";

function snapshot(names: string[]): LibraryIndexSnapshot {
  return {
    root: "/notes",
    builtAt: 1,
    truncated: false,
    entries: names.map((name) => ({
      path: `/notes/${name}`,
      name,
      isDirectory: false,
      size: 1,
      modifiedAt: 1,
      extension: "",
    })),
  };
}

describe("library index search", () => {
  it("ranks names that start with the query ahead of later substring hits", () => {
    const found = searchSnapshot(snapshot(["dog-cat.txt", "cat.txt"]), "cat");
    expect(found.hits.map((hit) => hit.name)).toEqual(["cat.txt", "dog-cat.txt"]);
    expect(found.truncated).toBe(false);
  });

  it("caps the hit list and marks the result truncated", () => {
    const names = Array.from({ length: 41 }, (_, index) => `cat-${index}.txt`);
    const found = searchSnapshot(snapshot(names), "cat");
    expect(found.hits).toHaveLength(40);
    expect(found.truncated).toBe(true);
  });
});
