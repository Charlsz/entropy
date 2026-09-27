import { describe, expect, it } from "vitest";
import { pathIdentityKey } from "./pathIdentity";

describe("path identity", () => {
  it("folds case on Windows and macOS and keeps it on Linux", () => {
    expect(pathIdentityKey("C:\\Photos\\A.jpg", "win32")).toBe("c:\\photos\\a.jpg");
    expect(pathIdentityKey("/Users/Ada/A.jpg", "darwin")).toBe("/users/ada/a.jpg");
    expect(pathIdentityKey("/Users/Ada/A.jpg", "linux")).toBe("/Users/Ada/A.jpg");
  });
});
