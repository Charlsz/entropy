/** Standalone markdown image embed: ![alt](src) or ![alt](src "title") */
export const MEDIA_LINE_RE = /^!\[([^\]]*)\]\((<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)$/;

/** Obsidian embed on its own line: ![[target]] or ![[target|alias]] */
export const WIKI_EMBED_LINE_RE = /^!\[\[([^\]|#\n]+?)(?:\|([^\]]*))?\]\]\s*$/;

export type MarkdownBlock =
  | { type: "text"; value: string }
  | { type: "media"; alt: string; src: string; raw: string };

function unwrapSrc(raw: string): string {
  if (raw.startsWith("<") && raw.endsWith(">")) return raw.slice(1, -1);
  return raw;
}

function basenameHint(target: string): string {
  const clean = target.replace(/\\/g, "/");
  return clean.split("/").pop() || target;
}

/** Obsidian size aliases like `|300` or `|300x200` are not captions. */
function wikiAlt(target: string, alias: string | undefined): string {
  const trimmed = alias?.trim();
  if (!trimmed) return basenameHint(target);
  if (/^\d+(?:x\d+)?$/i.test(trimmed)) return basenameHint(target);
  return trimmed;
}

function matchMediaLine(line: string): { alt: string; src: string } | null {
  const wiki = WIKI_EMBED_LINE_RE.exec(line.trimEnd());
  if (wiki) {
    const src = wiki[1]!.trim();
    return { alt: wikiAlt(src, wiki[2]), src };
  }

  const md = MEDIA_LINE_RE.exec(line.trimEnd());
  if (md) {
    return { alt: md[1]!, src: unwrapSrc(md[2]!) };
  }

  return null;
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
    const media = matchMediaLine(line);
    if (media) {
      flushText();
      blocks.push({
        type: "media",
        alt: media.alt,
        src: media.src,
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

/** Obsidian-style embed (preferred for Entropy inserts — matches vault notes). */
export function mediaEmbedMarkdown(src: string, alias?: string): string {
  const target = src.replace(/\\/g, "/");
  const base = basenameHint(target);
  if (alias && alias.trim() && alias.trim() !== base && alias.trim() !== src) {
    return `![[${target}|${alias.trim()}]]`;
  }
  return `![[${target}]]`;
}

export function mediaMarkdown(alt: string, src: string): string {
  return mediaEmbedMarkdown(src, alt);
}

export function linkMarkdown(label: string, href: string): string {
  return `[${label}](${formatMarkdownHref(href)})`;
}

/**
 * Turn Obsidian `![[…]]` lines into standard image markdown so marked can render them.
 */
export function expandWikiEmbedsForPreview(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      const wiki = WIKI_EMBED_LINE_RE.exec(line.trimEnd());
      if (!wiki) return line;
      const src = wiki[1]!.trim();
      const alt = wikiAlt(src, wiki[2]);
      return `![${alt}](${formatMarkdownHref(src)})`;
    })
    .join("\n");
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

/** True when a dropped/linked path should become a live `![]()` / `![[]]` face. */
export function isLiveEmbedExt(extension: string): boolean {
  const ext = extension.toLowerCase();
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || PDF_EXT.has(ext);
}
