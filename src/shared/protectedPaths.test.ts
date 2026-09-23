import { describe, expect, it } from "vitest";
import {
  assertPathMutable,
  isProtectedOsPath,
  isUnsafeReclaimPath,
} from "./protectedPaths";

describe("protected paths", () => {
  it("blocks Windows system trees and the drive root itself", () => {
    expect(isProtectedOsPath("C:\\Windows\\System32", "win32")).toBe(true);
    expect(isProtectedOsPath("C:\\Program Files\\App", "win32")).toBe(true);
    expect(isProtectedOsPath("D:\\", "win32")).toBe(true);
    expect(isProtectedOsPath("C:\\Users\\ada\\notes", "win32")).toBe(false);
  });

  it("blocks Unix system trees and allows a home folder", () => {
    expect(isProtectedOsPath("/System/Library", "darwin")).toBe(true);
    expect(isProtectedOsPath("/usr/bin", "linux")).toBe(true);
    expect(isProtectedOsPath("/usr/local/bin", "linux")).toBe(false);
    expect(isProtectedOsPath("/home/ada/notes", "linux")).toBe(false);
  });

  it("refuses to mutate a protected path the way trash does", () => {
    expect(() => assertPathMutable("C:\\Windows", "win32", "trash")).toThrow(/Protected system path/);
    expect(() => assertPathMutable("C:\\Users\\ada\\file.txt", "win32", "trash")).not.toThrow();
  });

  it("treats tooling directories as unsafe to reclaim", () => {
    expect(isUnsafeReclaimPath("C:\\Users\\ada\\proj\\node_modules\\pkg\\index.js", "win32")).toBe(
      true,
    );
    expect(isUnsafeReclaimPath("C:\\Users\\ada\\proj\\readme.md", "win32")).toBe(false);
  });
});
