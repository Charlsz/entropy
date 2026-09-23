import assert from "node:assert/strict";
import { recentSnapshot, searchSnapshot } from "../src/shared/libraryIndexQuery.ts";

const snapshot = {
  root: "E:\\",
  builtAt: 1,
  truncated: false,
  entries: [
    {
      path: "E:\\photos\\a.png",
      name: "a.png",
      isDirectory: false,
      size: 10,
      modifiedAt: 20,
      extension: ".png",
    },
    {
      path: "E:\\photos",
      name: "photos",
      isDirectory: true,
      size: 0,
      modifiedAt: 5,
      extension: "",
    },
    {
      path: "E:\\notes\\b.txt",
      name: "b.txt",
      isDirectory: false,
      size: 4,
      modifiedAt: 50,
      extension: ".txt",
    },
  ],
};

const found = searchSnapshot(snapshot, "png");
assert.equal(found.hits.length, 1);
assert.equal(found.hits[0]?.source, "file");
assert.equal(searchSnapshot(snapshot, "photo").hits[0]?.source, "folder");

const recent = recentSnapshot(snapshot);
assert.equal(recent.files.length, 2);
assert.equal(recent.files[0]?.name, "b.txt");
assert.equal(recent.files[1]?.name, "a.png");

console.log("library index query ok");
