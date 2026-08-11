/** Standalone markdown image embed: ![alt](src) or ![alt](src "title") */
export const MEDIA_LINE_RE = /^!\[([^\]]*)\]\((<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)$/;

/** Obsidian embed on its own line: ![[target]] or ![[target|alias]] */
export const WIKI_EMBED_LINE_RE = /^!\[\[([^\]|#\n]+?)(?:\|([^\]]*))?\]\]\s*$/;

/** Obsidian file link on its own line: [[target]] or [[target|alias]] (not an embed). */
export const WIKI_LINK_LINE_RE = /^\[\[([^\]|#\n]+?)(?:\|([^\]]*))?\]\]\s*$/;

export type MarkdownBlock =
  | { type: "text"; value: string }
  | { type: "media"; alt: string; src: string; raw: string }
  | { type: "fileRef"; label: string; src: string; raw: string };

const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".mkv", ".m4v", ".avi", ".wmv"]);
const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".avif",
  ".heic",
  ".tif",
  ".tiff",
  ".ico",
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

function matchFaceLine(
  line: string,
):
  | { kind: "media"; alt: string; src: string }
  | { kind: "fileRef"; label: string; src: string }
  | null {
  const wikiEmbed = WIKI_EMBED_LINE_RE.exec(line.trimEnd());
  if (wikiEmbed) {
    const src = wikiEmbed[1]!.trim();
    return { kind: "media", alt: wikiAlt(src, wikiEmbed[2]), src };
  }

  const wikiLink = WIKI_LINK_LINE_RE.exec(line.trimEnd());
  if (wikiLink) {
    const src = wikiLink[1]!.trim();
    const label = wikiAlt(src, wikiLink[2]);
    // Previewable targets still become live media faces even without `!`.
    if (embedKind(src) !== "other") {
      return { kind: "media", alt: label, src };
    }
    return { kind: "fileRef", label, src };
  }

  const md = MEDIA_LINE_RE.exec(line.trimEnd());
  if (md) {
    return { kind: "media", alt: md[1]!, src: unwrapSrc(md[2]!) };
  }

  return null;
}

/** Split markdown into text, media embeds, and file-reference chips. */
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
    const face = matchFaceLine(line);
    if (face?.kind === "media") {
      flushText();
      blocks.push({
        type: "media",
        alt: face.alt,
        src: face.src,
        raw: line,
      });
    } else if (face?.kind === "fileRef") {
      flushText();
      blocks.push({
        type: "fileRef",
        label: face.label,
        src: face.src,
        raw: line,
      });
    } else {
      textLines.push(line);
    }
  }

  flushText();

  if (blocks.length === 0) return [{ type: "text", value: "" }];
  // Always leave a text caret after a trailing face (Obsidian-style continue writing).
  const last = blocks[blocks.length - 1];
  if (last?.type === "media" || last?.type === "fileRef") {
    blocks.push({ type: "text", value: "" });
  }
  return blocks;
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

export function linkMarkdown(label: string, href: string): string {
  return `[${label}](${formatMarkdownHref(href)})`;
}

/** Wiki file link (non-embed) — rendered as a FileRef chip in the live editor. */
export function fileWikiLinkMarkdown(src: string, alias?: string): string {
  const target = src.replace(/\\/g, "/");
  if (alias && alias.trim() && alias.trim() !== basenameHint(target)) {
    return `[[${target}|${alias.trim()}]]`;
  }
  return `[[${target}]]`;
}

/**
 * Markdown to copy when referencing a Library file from Folders/Gallery.
 * Previewable media → embed; everything else → wiki file link.
 */
export function fileReferenceClipboardMarkdown(
  filePath: string,
  extension: string,
  label?: string,
): string {
  const target = filePath.replace(/\\/g, "/");
  if (isLiveEmbedExt(extension)) {
    return mediaEmbedMarkdown(target, label);
  }
  return fileWikiLinkMarkdown(target, label);
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
