import { describe, expect, it } from "vitest";
import { noteBufferFor } from "./noteContext";

describe("note buffer binding", () => {
  it("uses the live buffer only for the note that produced it", () => {
    const live = { path: "C:\\Notes\\a.md", content: "from a" };
    expect(noteBufferFor("c:/notes/a.md", live, "win32")).toBe("from a");
    expect(noteBufferFor("C:\\Notes\\b.md", live, "win32")).toBeNull();
    expect(noteBufferFor("/notes/a.md", { path: "/notes/A.md", content: "x" }, "linux")).toBeNull();
  });
});
