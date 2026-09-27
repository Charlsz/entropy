import { describe, expect, it } from "vitest";
import {
  recentSnapshot,
  searchSnapshot,
  selectRecentEntries,
  type LibraryIndexEntry,
  type LibraryIndexSnapshot,
} from "./libraryIndexQuery";

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

describe("recent files", () => {
  it("matches a stable sort and skips directories", () => {
    const entries: LibraryIndexEntry[] = [
      { path: "/a", name: "a", isDirectory: false, size: 1, modifiedAt: 5, extension: "" },
      { path: "/dir", name: "dir", isDirectory: true, size: 0, modifiedAt: 99, extension: "" },
      { path: "/b", name: "b", isDirectory: false, size: 1, modifiedAt: 5, extension: "" },
      { path: "/c", name: "c", isDirectory: false, size: 1, modifiedAt: 9, extension: "" },
      { path: "/d", name: "d", isDirectory: false, size: 1, modifiedAt: 1, extension: "" },
    ];
    const expected = entries
      .filter((entry) => !entry.isDirectory)
      .sort((left, right) => right.modifiedAt - left.modifiedAt)
      .slice(0, 2)
      .map((entry) => entry.path);
    expect(selectRecentEntries(entries, 2).map((entry) => entry.path)).toEqual(expected);
    expect(recentSnapshot({ root: "/", builtAt: 1, truncated: false, entries }, 2).files.map((file) => file.path)).toEqual(
      expected,
    );
  });
});
