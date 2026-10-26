import { describe, expect, it } from "vitest";
import { lookupMeasuredSize } from "./measuredSize";

describe("lookupMeasuredSize", () => {
  it("matches the listing path when separators and case differ on Windows", () => {
    const sizes = { "C:\\Users\\ada\\Desktop": 4096 };
    expect(lookupMeasuredSize(sizes, "C:\\Users\\ada\\Desktop", "win32")).toBe(4096);
    expect(lookupMeasuredSize(sizes, "c:/Users/ada/Desktop", "win32")).toBe(4096);
  });

  it("stays case-sensitive on Linux so sibling folders do not collide", () => {
    const sizes = { "/home/ada/Photos": 8 };
    expect(lookupMeasuredSize(sizes, "/home/ada/Photos", "linux")).toBe(8);
    expect(lookupMeasuredSize(sizes, "/home/ada/photos", "linux")).toBeUndefined();
  });
});
