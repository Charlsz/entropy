import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { parseMarkdownBlocks } from "../lib/markdownBlocks";

/** Shared Markdown manager — text-only extensions (embeds handled via block split). */
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
  ],
});

/**
 * Notes store the title in the filename. If the body still starts with a matching
 * `# Title` (legacy createNote), strip it so the page title isn’t duplicated.
 */
export function stripMatchingLeadingTitle(markdown: string, title: string): string {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return markdown;
  const match = /^(?:---\r?\n[\s\S]*?\r?\n---\r?\n)?#\s+(.+?)\s*\r?\n([\s\S]*)$/.exec(markdown);
  if (!match) return markdown;
  if (match[1]!.trim() !== trimmedTitle) return markdown;
  return match[2]!.replace(/^\r?\n/, "");
}

export function markdownToTipTapDoc(markdown: string): JSONContent {
  const blocks = parseMarkdownBlocks(markdown || "");
  const content: JSONContent[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      const value = block.value;
      if (!value.trim()) {
        content.push({ type: "paragraph" });
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

    // Skip trailing empty paragraphs so saves stay clean.
    if (
      node.type === "paragraph" &&
      (!node.content || node.content.length === 0) &&
      parts.length === 0
    ) {
      continue;
    }

    const slice: JSONContent = { type: "doc", content: [node] };
    const md = markdownManager.serialize(slice).replace(/\n+$/, "");
    parts.push(md);
  }

  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n");
}
