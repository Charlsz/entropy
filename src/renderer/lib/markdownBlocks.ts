/** Standalone markdown image embed: ![alt](src) or ![alt](src "title") */
export const MEDIA_LINE_RE =
  /^!\[([^\]]*)\]\((<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)$/;

/** Standalone markdown link: [label](src) or [label](src "title") */
export const LINK_LINE_RE =
  /^\[([^\]]+)\]\((<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)$/;

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
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".opus"]);
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

function unwrapSrc(raw: string): string {
  if (raw.startsWith("<") && raw.endsWith(">")) return raw.slice(1, -1);
  return raw;
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

function matchFaceLine(
  line: string,
):
  | { kind: "media"; alt: string; src: string }
  | { kind: "fileRef"; label: string; src: string }
  | null {
  const trimmed = line.trimEnd();

  // Embeds first — `![[…]]` is preview; `[[…]]` is a link/card.
  const wikiEmbed = WIKI_EMBED_LINE_RE.exec(trimmed);
  if (wikiEmbed) {
    const src = wikiEmbed[1]!.trim();
    return { kind: "media", alt: wikiAlt(src, wikiEmbed[2]), src };
  }

  const video = HTML_VIDEO_LINE_RE.exec(trimmed);
  if (video) {
    const src = video[1]!.trim();
    return { kind: "media", alt: basenameHint(src), src };
  }

  const audio = HTML_AUDIO_LINE_RE.exec(trimmed);
  if (audio) {
    const src = audio[1]!.trim();
    return { kind: "media", alt: basenameHint(src), src };
  }

  const iframe = HTML_IFRAME_LINE_RE.exec(trimmed);
  if (iframe) {
    const src = iframe[1]!.trim();
    return { kind: "media", alt: basenameHint(src), src };
  }

  const mdImage = MEDIA_LINE_RE.exec(trimmed);
  if (mdImage) {
    return { kind: "media", alt: mdImage[1]!, src: unwrapSrc(mdImage[2]!) };
  }

  const wikiLink = WIKI_LINK_LINE_RE.exec(trimmed);
  if (wikiLink) {
    const src = wikiLink[1]!.trim();
    const label = wikiAlt(src, wikiLink[2]);
    return { kind: "fileRef", label, src };
  }

  const mdLink = LINK_LINE_RE.exec(trimmed);
  if (mdLink) {
    const label = mdLink[1]!;
    const src = unwrapSrc(mdLink[2]!);
    if (isRemoteHref(src)) return null;
    // Local file links become portable file cards (PDF/docs/etc.).
    return { kind: "fileRef", label, src };
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
      const trimmed = line.trimEnd();
      const wiki = WIKI_EMBED_LINE_RE.exec(trimmed);
      if (!wiki) return line;
      const src = wiki[1]!.trim();
      const alt = wikiAlt(src, wiki[2]);
      const kind = embedKind(src);
      if (kind === "video") {
        return `<video controls src="${escapeHtmlAttr(src)}"></video>`;
      }
      if (kind === "audio") {
        return `<audio controls src="${escapeHtmlAttr(src)}"></audio>`;
      }
      if (kind === "pdf") {
        return `<iframe src="${escapeHtmlAttr(src)}" title="${escapeHtmlAttr(alt)}"></iframe>`;
      }
      if (kind === "image" || kind === "other") {
        // Images + unknown: standard Markdown image / link fallback for marked.
        if (kind === "image") return `![${alt}](${formatMarkdownHref(src)})`;
        return `[${alt}](${formatMarkdownHref(src)})`;
      }
      return line;
    })
    .join("\n");
}
