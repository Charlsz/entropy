import assert from "node:assert/strict";
import path from "node:path";
import {
  basenamePath,
  dirnamePath,
  joinPath,
  relativePath,
} from "../src/shared/paths.ts";

function slash(value: string): string {
  return value.split(path.win32.sep).join("/");
}

const winJoin: string[][] = [
  ["C:\\foo", "D:\\bar"],
  ["C:\\foo", "\\bar"],
  ["C:\\foo", "..", "bar"],
  ["C:\\", "Users"],
  ["E:\\", "photos", "a.png"],
  ["\\\\server\\share", "a"],
  ["C:/Users/a", "b"],
  ["foo", ".."],
  ["C:\\Users\\a\\", "notes", "one.md"],
  ["foo", "bar", "..", "baz"],
  [],
];

for (const parts of winJoin) {
  const got = joinPath("win32", ...parts);
  const expected = path.win32.join(...parts);
  assert.equal(got, expected, `win join ${JSON.stringify(parts)} got ${got}`);
}

const winPaths = [
  "C:\\Users\\a",
  "C:\\",
  "C:",
  "E:\\photos\\a.png",
  "\\\\server\\share\\a",
  "/usr/local",
  "foo\\bar",
  "foo",
];

for (const filePath of winPaths) {
  assert.equal(dirnamePath("win32", filePath), path.win32.dirname(filePath), `dirname ${filePath}`);
  assert.equal(
    basenamePath("win32", filePath),
    path.win32.basename(filePath),
    `basename ${filePath}`,
  );
}

const winRel: Array<[string, string]> = [
  ["C:\\Users\\a", "C:\\Users\\a\\b\\c"],
  ["C:\\Users\\a", "D:\\x"],
  ["C:\\Users\\a\\b", "C:\\Users\\a"],
  ["C:\\Users\\a", "C:\\Users\\a"],
  ["C:\\Users\\A\\notes", "c:\\users\\a\\notes\\fig.png"],
];

for (const [from, to] of winRel) {
  const got = relativePath("win32", from, to);
  const expected = slash(path.win32.relative(from, to));
  assert.equal(got, expected, `win relative ${from} -> ${to} got ${got} expected ${expected}`);
}

const posixJoin = [
  ["/a", "b", "..", "c"],
  ["a", "b"],
  ["/"],
];
for (const parts of posixJoin) {
  assert.equal(joinPath("linux", ...parts), path.posix.join(...parts), `posix join ${parts}`);
}
assert.equal(dirnamePath("darwin", "/a/b"), path.posix.dirname("/a/b"));
assert.equal(basenamePath("linux", "/a/b.txt"), path.posix.basename("/a/b.txt"));
assert.equal(relativePath("linux", "/a/b", "/a/b/c"), path.posix.relative("/a/b", "/a/b/c"));

console.log("path helpers match node:path");
