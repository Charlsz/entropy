import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { parseMarkdownBlocks } from "../lib/markdownBlocks";
import { EntropyFileRef, EntropyMedia } from "./entropyEmbedExtensions";

/** Shared Markdown manager for converting text segments outside the live editor. */
const markdownManager = new MarkdownManager({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
    }),
    EntropyMedia,
    EntropyFileRef,
  ],
});

export function markdownToTipTapDoc(markdown: string): JSONContent {
  const blocks = parseMarkdownBlocks(markdown || "");
  const content: JSONContent[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      const value = block.value;
      if (!value.trim()) {
        // Preserve blank gaps between embeds as empty paragraphs.
        const blankLines = value.split("\n").length - 1;
        const count = Math.max(1, blankLines > 0 && !value.trim() ? blankLines : 1);
        for (let i = 0; i < Math.min(count, 2); i += 1) {
          content.push({ type: "paragraph" });
        }
        continue;
      }
      const parsed = markdownManager.parse(value) as JSONContent;
      if (parsed.content?.length) {
        content.push(...parsed.content);
      } else {
        content.push({ type: "paragraph" });
      }
      continue;
    }

    if (block.type === "media") {
      content.push({
        type: "entropyMedia",
        attrs: {
          src: block.src,
          alt: block.alt,
          raw: block.raw,
        },
      });
      continue;
    }

    content.push({
      type: "entropyFileRef",
      attrs: {
        src: block.src,
        label: block.label,
        raw: block.raw,
      },
    });
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

export function tipTapDocToMarkdown(doc: JSONContent): string {
  const nodes = doc.content ?? [];
  if (nodes.length === 0) return "";

  const parts: string[] = [];

  for (const node of nodes) {
    if (node.type === "entropyMedia") {
      const raw = String(node.attrs?.raw ?? "");
      if (raw) {
        parts.push(raw);
        continue;
      }
      const src = String(node.attrs?.src ?? "");
      const alt = String(node.attrs?.alt ?? "");
      parts.push(alt ? `![[${src}|${alt}]]` : `![[${src}]]`);
      continue;
    }

    if (node.type === "entropyFileRef") {
      const raw = String(node.attrs?.raw ?? "");
      if (raw) {
        parts.push(raw);
        continue;
      }
      const src = String(node.attrs?.src ?? "");
      const label = String(node.attrs?.label ?? "");
      parts.push(label ? `[[${src}|${label}]]` : `[[${src}]]`);
      continue;
    }

    const slice: JSONContent = { type: "doc", content: [node] };
    const md = markdownManager.serialize(slice).replace(/\n+$/, "");
    parts.push(md);
  }

  return parts.join("\n");
}
