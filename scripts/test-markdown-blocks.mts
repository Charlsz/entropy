import assert from "node:assert/strict";
import {
  markdownToTipTapDoc,
  tipTapDocToMarkdown,
} from "../src/renderer/editor/markdownDoc";
import {
  normalizeFaceCandidate,
  parseMarkdownBlocks,
  parseParenDestination,
  portableFileMarkdown,
} from "../src/renderer/lib/markdownBlocks";
import { listLocalFileReferences } from "../src/renderer/lib/noteContext";

function typesOf(markdown: string): string[] {
  return parseMarkdownBlocks(markdown)
    .filter((block) => block.type !== "text" || block.value.trim())
    .map((block) => {
      if (block.type === "text") return "text";
      if (block.type === "media") return `media:${block.src}`;
      return `fileRef:${block.src}`;
    });
}

// Destinations with spaces (Windows "Personal Space", titled PDFs, etc.)
assert.equal(
  parseParenDestination("C:/Users/Cgalv/Desktop/Personal Space/ok.png"),
  "C:/Users/Cgalv/Desktop/Personal Space/ok.png",
);
assert.equal(
  parseParenDestination("<C:/Users/Cgalv/Desktop/Alerta — Riesgo Climático Agrícola.pdf>"),
  "C:/Users/Cgalv/Desktop/Alerta — Riesgo Climático Agrícola.pdf",
);

// TipTap escape recovery
assert.equal(
  normalizeFaceCandidate("!\\[cat-pixel.gif\\](C:/Users/a/cat-pixel.gif)"),
  "![cat-pixel.gif](C:/Users/a/cat-pixel.gif)",
);

const samples = [
  '<video controls src="C:/Users/Cgalv/Desktop/images/charlie.mp4"></video>',
  "[Alerta — Riesgo Climático Agrícola.pdf](<C:/Users/Cgalv/Desktop/Alerta — Riesgo Climático Agrícola.pdf>)",
  "![cat-pixel.gif](C:/Users/Cgalv/Desktop/my-website/public/images/cat-pixel.gif)",
  "![shot.png](C:/Users/Cgalv/Desktop/Personal Space/shot.png)",
  "![[charlie.mp4]]",
  "![[Alerta — Riesgo Climático Agrícola.pdf]]",
  "!\\[escaped.gif\\](C:/Users/a/escaped.gif)",
].join("\n\n");

const parsed = parseMarkdownBlocks(samples);
const mediaOrRef = parsed.filter((block) => block.type === "media" || block.type === "fileRef");
assert.equal(mediaOrRef.length, 7, `expected 7 faces, got ${mediaOrRef.length}: ${typesOf(samples)}`);

const doc = markdownToTipTapDoc(samples);
const nodeTypes = (doc.content ?? []).map((node) => node.type);
assert.ok(nodeTypes.includes("entropyMedia"), `doc missing entropyMedia: ${nodeTypes.join(",")}`);
assert.ok(nodeTypes.includes("entropyFileRef"), `doc missing entropyFileRef: ${nodeTypes.join(",")}`);
assert.ok(
  !nodeTypes.some((type, index) => {
    const node = doc.content?.[index];
    return (
      type === "paragraph" &&
      typeof node?.content?.[0]?.text === "string" &&
      /<!?video|!\[cat-pixel|Personal Space/.test(node.content[0].text)
    );
  }),
  "face markup leaked into a paragraph node",
);

const round = tipTapDocToMarkdown(doc);
const reparsed = parseMarkdownBlocks(round);
assert.ok(
  reparsed.some((block) => block.type === "media" && block.src.includes("charlie.mp4")),
  "video face lost after round-trip",
);
assert.ok(
  reparsed.some((block) => block.type === "media" && block.src.includes("cat-pixel.gif")),
  "gif face lost after round-trip",
);
assert.ok(
  reparsed.some((block) => block.type === "fileRef" && block.src.includes("Alerta")),
  "pdf file card lost after round-trip",
);
assert.ok(
  reparsed.some((block) => block.type === "media" && block.src.includes("Personal Space")),
  "spaced-path image lost after round-trip",
);

assert.equal(
  portableFileMarkdown("../Videos/demo.mp4", ".mp4", "demo.mp4"),
  '<video controls src="../Videos/demo.mp4"></video>',
);
assert.equal(
  portableFileMarkdown("./photo.jpg", ".jpg", "photo.jpg"),
  "![photo.jpg](./photo.jpg)",
);
assert.match(
  portableFileMarkdown("./Personal Space/a.png", ".png", "a.png"),
  /^!\[a\.png\]\(<\.\/Personal Space\/a\.png>\)$/,
);

const listed = listLocalFileReferences(
  [
    "![a.png](./a.png)",
    "",
    '<video controls src="./v.mp4"></video>',
    "",
    "[doc.pdf](<./Personal Space/doc.pdf>)",
  ].join("\n"),
);
assert.equal(listed.length, 3);
assert.ok(listed.some((item) => item.href.includes("v.mp4")));
assert.ok(listed.some((item) => item.href.includes("doc.pdf")));

console.log("markdown-blocks: ok");
