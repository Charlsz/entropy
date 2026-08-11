/**
 * Entropy face-line parser: Markdown images/links, HTML video/audio/iframe,
 * and Obsidian `![[…]]` / `[[…]]` — all share one resolver downstream.
 *
 * Destinations may include spaces and Windows absolute paths. TipTap may escape
 * broken faces as `!\[alt\](src)`; we recover those on load.
 */

/** @deprecated Prefer parseParenDestination; kept for callers/tests. */
export const MEDIA_LINE_RE =
  /^!\[([^\]]*)\]\((<[^>\n]+>|[^)\n]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)$/;

/** @deprecated Prefer parseParenDestination; kept for callers/tests. */
export const LINK_LINE_RE =
  /^\[([^\]]+)\]\((<[^>\n]+>|[^)\n]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)$/;

/** Obsidian embed on its own line: ![[target]] or ![[target|alias]] */
export const WIKI_EMBED_LINE_RE = /^!\[\[([^\]|#\n]+?)(?:\|([^\]]*))?\]\]\s*$/;

/** Obsidian file link on its own line: [[target]] or [[target|alias]] (not an embed). */
export const WIKI_LINK_LINE_RE = /^\[\[([^\]|#\n]+?)(?:\|([^\]]*))?\]\]\s*$/;

/** Single-line HTML video: <video … src="…"> or with closing tag. */
export const HTML_VIDEO_LINE_RE =
  /^<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*(?:<\/video>)?\s*$/i;

/** Single-line HTML audio. */
export const HTML_AUDIO_LINE_RE =
  /^<audio\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*(?:<\/audio>)?\s*$/i;

/** Single-line HTML iframe (PDF / generic). */
export const HTML_IFRAME_LINE_RE =
  /^<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*(?:<\/iframe>)?\s*$/i;

export type MarkdownBlock =
  | { type: "text"; value: string }
  | { type: "media"; alt: string; src: string; raw: string }
  | { type: "fileRef"; label: string; src: string; raw: string };

const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".mkv", ".m4v", ".avi", ".wmv"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".flac", ".aac", ".opus"]);
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

export type EmbedKind = "image" | "video" | "audio" | "pdf" | "other";

export function embedKind(href: string): EmbedKind {
  const ext = extensionOfHref(href);
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (IMAGE_EXT.has(ext)) return "image";
  if (PDF_EXT.has(ext)) return "pdf";
  if (/^(https?:|data:)/i.test(href) && !ext) return "image";
  return "other";
}

/** Image / video / audio / pdf — inserted as a live preview face (not a plain chip). */
export function isLiveEmbedExt(extension: string): boolean {
  const ext = extension.toLowerCase().startsWith(".")
    ? extension.toLowerCase()
    : `.${extension.toLowerCase()}`;
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext) || PDF_EXT.has(ext);
}

function basenameHint(target: string): string {
  const clean = target.replace(/\\/g, "/");
  return clean.split("/").pop() || target;
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Obsidian size aliases like `|300` or `|300x200` are not captions. */
function wikiAlt(target: string, alias: string | undefined): string {
  const trimmed = alias?.trim();
  if (!trimmed) return basenameHint(target);
  if (/^\d+(?:x\d+)?$/i.test(trimmed)) return basenameHint(target);
  return trimmed;
}

function isRemoteHref(href: string): boolean {
  return /^(https?:|mailto:|data:|#)/i.test(href);
}

/**
 * Recover TipTap-escaped face markup that previously fell through as paragraph text:
 * `!\[alt\](src)` → `![alt](src)`, `&lt;video` → `<video`.
 */
export function normalizeFaceCandidate(line: string): string {
  let s = line.trim();
  if (!s) return s;
  s = s.replace(/^!\\\[/, "![").replace(/\\\]\(/g, "](");
  s = s.replace(/^\\\[/, "[");
  s = s.replace(/^&lt;(?=(\/?)(video|audio|iframe)\b)/i, "<");
  s = s.replace(/&gt;/g, ">");
  return s;
}

/**
 * Parse the inside of Markdown `(…)`, including spaces and Windows absolute paths.
 * Supports `<angled>` form and optional `"title"` / `'title'`.
 */
export function parseParenDestination(inside: string): string | null {
  const trimmed = inside.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("<")) {
    const close = trimmed.indexOf(">");
    if (close < 1) return null;
    return trimmed.slice(1, close).trim() || null;
  }

  const withTitle = /^(.*?)\s+("([^"]*)"|'([^']*)')\s*$/.exec(trimmed);
  if (withTitle) {
    const href = withTitle[1]!.trim();
    return href || null;
  }

  return trimmed;
}

function matchMdImageLine(
  line: string,
): { alt: string; src: string } | null {
  const match = /^!\[([^\]]*)\]\((.*)\)$/.exec(line);
  if (!match) return null;
  const src = parseParenDestination(match[2]!);
  if (!src) return null;
  return { alt: match[1]!, src };
}

function matchMdLinkLine(
  line: string,
): { label: string; src: string } | null {
  // Images start with `![` — don't treat them as links.
  if (line.startsWith("![")) return null;
  const match = /^\[([^\]]+)\]\((.*)\)$/.exec(line);
  if (!match) return null;
  const src = parseParenDestination(match[2]!);
  if (!src) return null;
  return { label: match[1]!, src };
}

function matchFaceLine(
  line: string,
):
  | { kind: "media"; alt: string; src: string; raw: string }
  | { kind: "fileRef"; label: string; src: string; raw: string }
  | null {
  const original = line.trimEnd();
  const trimmed = normalizeFaceCandidate(original);
  if (!trimmed) return null;

  const wikiEmbed = WIKI_EMBED_LINE_RE.exec(trimmed);
  if (wikiEmbed) {
    const src = wikiEmbed[1]!.trim();
    return { kind: "media", alt: wikiAlt(src, wikiEmbed[2]), src, raw: trimmed };
  }

  const video = HTML_VIDEO_LINE_RE.exec(trimmed);
  if (video) {
    const src = video[1]!.trim();
    return { kind: "media", alt: basenameHint(src), src, raw: trimmed };
  }

  const audio = HTML_AUDIO_LINE_RE.exec(trimmed);
  if (audio) {
    const src = audio[1]!.trim();
    return { kind: "media", alt: basenameHint(src), src, raw: trimmed };
  }

  const iframe = HTML_IFRAME_LINE_RE.exec(trimmed);
  if (iframe) {
    const src = iframe[1]!.trim();
    return { kind: "media", alt: basenameHint(src), src, raw: trimmed };
  }

  const mdImage = matchMdImageLine(trimmed);
  if (mdImage) {
    return { kind: "media", alt: mdImage.alt, src: mdImage.src, raw: trimmed };
  }

  const wikiLink = WIKI_LINK_LINE_RE.exec(trimmed);
  if (wikiLink) {
    const src = wikiLink[1]!.trim();
    const label = wikiAlt(src, wikiLink[2]);
    return { kind: "fileRef", label, src, raw: trimmed };
  }

  const mdLink = matchMdLinkLine(trimmed);
  if (mdLink) {
    if (isRemoteHref(mdLink.src)) return null;
    return { kind: "fileRef", label: mdLink.label, src: mdLink.src, raw: trimmed };
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
        raw: face.raw,
      });
    } else if (face?.kind === "fileRef") {
      flushText();
      blocks.push({
        type: "fileRef",
        label: face.label,
        src: face.src,
        raw: face.raw,
      });
    } else {
      textLines.push(line);
    }
  }

  flushText();

  if (blocks.length === 0) return [{ type: "text", value: "" }];
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

/**
 * Preferred portable insert for Notebook Reference / drag-drop.
 * Images → Markdown; video/audio → HTML; everything else → Markdown link.
 * Never copies files — only writes a path relative to the note when possible.
 */
export function portableFileMarkdown(
  src: string,
  extension: string,
  label?: string,
): string {
  const target = src.replace(/\\/g, "/");
  const name = (label?.trim() || basenameHint(target)).replace(/[[\]\n]/g, "");
  const ext = extension.toLowerCase().startsWith(".")
    ? extension.toLowerCase()
    : `.${extension.toLowerCase()}`;
  let kind = embedKind(target);
  if (kind === "other") kind = embedKind(`file${ext}`);

  if (kind === "image") {
    return `![${name}](${formatMarkdownHref(target)})`;
  }
  if (kind === "video") {
    return `<video controls src="${escapeHtmlAttr(target)}"></video>`;
  }
  if (kind === "audio") {
    return `<audio controls src="${escapeHtmlAttr(target)}"></audio>`;
  }
  return linkMarkdown(name, target);
}

/** Obsidian-style embed — compatibility only; new inserts use {@link portableFileMarkdown}. */
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
 */
export function fileReferenceClipboardMarkdown(
  filePath: string,
  extension: string,
  label?: string,
): string {
  const target = filePath.replace(/\\/g, "/");
  return portableFileMarkdown(target, extension, label);
}

/**
 * Expand wiki embeds / normalize known faces for marked-based reading view.
 * Does not rewrite the note on disk — preview-only.
 */
export function expandWikiEmbedsForPreview(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      const face = matchFaceLine(line);
      if (!face) return line;
      if (face.kind === "fileRef") {
        return `[${face.label}](${formatMarkdownHref(face.src)})`;
      }
      const kind = embedKind(face.src);
      if (kind === "video") {
        return `<video controls src="${escapeHtmlAttr(face.src)}"></video>`;
      }
      if (kind === "audio") {
        return `<audio controls src="${escapeHtmlAttr(face.src)}"></audio>`;
      }
      if (kind === "pdf") {
        return `<iframe src="${escapeHtmlAttr(face.src)}" title="${escapeHtmlAttr(face.alt)}"></iframe>`;
      }
      return `![${face.alt}](${formatMarkdownHref(face.src)})`;
    })
    .join("\n");
}
