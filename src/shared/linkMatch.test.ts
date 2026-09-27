import { describe, expect, it } from "vitest";
import { pathsMatchLink } from "./linkMatch";

describe("link target matching", () => {
  it("matches the same path and a missing .md extension", () => {
    expect(pathsMatchLink("C:\\Notes\\a.md", "c:/notes/a.md")).toBe(true);
    expect(pathsMatchLink("/notes/a", "/notes/a.md")).toBe(true);
    expect(pathsMatchLink("/notes/a.md", "/notes/a")).toBe(true);
  });

  it("does not treat the same file name in another folder as a match", () => {
    expect(pathsMatchLink("/photos/photo.png", "/camera/photo.png")).toBe(false);
    expect(pathsMatchLink("D:\\a\\note.md", "D:\\b\\note.md")).toBe(false);
  });
});
