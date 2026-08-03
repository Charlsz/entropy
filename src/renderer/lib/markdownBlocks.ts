/** Standalone markdown image embed on its own line: ![alt](src) or ![alt](src "title") */
export const MEDIA_LINE_RE = /^!\[([^\]]*)\]\((<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)$/;

export type MarkdownBlock =
  | { type: "text"; value: string }
  | { type: "media"; alt: string; src: string; raw: string };

function unwrapSrc(raw: string): string {
  if (raw.startsWith("<") && raw.endsWith(">")) return raw.slice(1, -1);
  return raw;
}

/** Split markdown into text and standalone media-embed blocks (Obsidian-style live embeds). */
export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  if (!content) return [{ type: "text", value: "" }];

  const lines = content.split("\n");
  const blocks: MarkdownBlock[] = [];
  let textLines: string[] = [];

  const flushText = () => {
    if (textLines.length === 0) return;
    blocks.push({ type: "text", value: textLines.join("\n") });
    textLines = [];
  };

  for (const line of lines) {
    const match = MEDIA_LINE_RE.exec(line.trimEnd());
    if (match) {
      flushText();
      const src = unwrapSrc(match[2]);
      blocks.push({
        type: "media",
        alt: match[1],
        src,
        raw: line,
      });
    } else {
      textLines.push(line);
    }
  }

  flushText();

  if (blocks.length === 0) return [{ type: "text", value: "" }];
  // Always leave a text caret after a trailing embed (Obsidian-style continue writing).
  if (blocks[blocks.length - 1]?.type === "media") {
    blocks.push({ type: "text", value: "" });
  }
  return blocks;
}

export function joinMarkdownBlocks(blocks: MarkdownBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "text") return block.value;
      return block.raw;
    })
    .join("\n");
}

/**
 * Wrap a destination so CommonMark / marked / live embeds accept it.
 * Bare destinations cannot contain spaces or unescaped parentheses.
 */
export function formatMarkdownHref(href: string): string {
  if (href.startsWith("<") && href.endsWith(">")) return href;
  if (/[\s()]/.test(href)) return `<${href}>`;
  return href;
}

/** Normalize path separators and format for a markdown href. */
export function markdownHrefFromPath(path: string): string {
  return formatMarkdownHref(path.replace(/\\/g, "/"));
}

export function mediaMarkdown(alt: string, src: string): string {
  return `![${alt}](${formatMarkdownHref(src)})`;
}

export function linkMarkdown(label: string, href: string): string {
  return `[${label}](${formatMarkdownHref(href)})`;
}

const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".mkv", ".m4v"]);
const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".avif",
]);
const PDF_EXT = new Set([".pdf"]);

export function extensionOfHref(href: string): string {
  const clean = href.split(/[?#]/)[0] ?? href;
  const base = clean.split(/[/\\]/).pop() ?? clean;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot).toLowerCase();
}

export type EmbedKind = "image" | "video" | "pdf" | "other";

export function embedKind(href: string): EmbedKind {
  const ext = extensionOfHref(href);
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  if (PDF_EXT.has(ext)) return "pdf";
  if (/^(https?:|data:)/i.test(href) && !ext) return "image";
  return "other";
}

/** True when a dropped/linked path should become a live `![]()` face. */
export function isLiveEmbedExt(extension: string): boolean {
  const ext = extension.toLowerCase();
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || PDF_EXT.has(ext);
}
