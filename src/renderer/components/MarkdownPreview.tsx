import { useEffect, useRef, useState, type MouseEvent } from "react";
import { marked } from "marked";
import { cn } from "../lib/utils";
import { expandWikiEmbedsForPreview } from "../lib/markdownBlocks";
import { useWorkspace } from "../state/useWorkspace";

marked.setOptions({
  gfm: true,
  breaks: true,
});

marked.use({
  renderer: {
    html() {
      return "";
    },
  },
});

interface MarkdownPreviewProps {
  content: string;
  notePath?: string | null;
  diskEpoch?: number;
  className?: string;
  onOpenLocal?: (absolutePath: string) => void;
}

const ATTR_RE = /\b(?:src|href)=["']([^"']+)["']/gi;

export function MarkdownPreview({
  content,
  notePath,
  diskEpoch = 0,
  className,
  onOpenLocal,
}: MarkdownPreviewProps) {
  const { workspace } = useWorkspace();
  const [html, setHtml] = useState("<p></p>");
  const localMap = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let rendered: string;
      try {
        const expanded = expandWikiEmbedsForPreview(content);
        rendered = marked.parse(expanded, { async: false }) as string;
      } catch {
        rendered = "<p>Could not render this note.</p>";
      }

      const map = new Map<string, string>();

      if (notePath) {
        try {
          ATTR_RE.lastIndex = 0;
          let match: RegExpExecArray | null;
          const seen = new Set<string>();
          while ((match = ATTR_RE.exec(rendered)) !== null) {
            const raw = match[1];
            if (!raw || /^(https?:|data:|entropy:|mailto:|#)/i.test(raw)) continue;
            if (seen.has(raw)) continue;
            seen.add(raw);
            try {
              const absolute = await window.entropy.fs.resolveEmbedTarget(
                raw,
                notePath,
                workspace.path,
              );
              if (!absolute) continue;
              const info = await window.entropy.fs.stat(absolute);
              map.set(raw, absolute);
              if (!info.isDirectory) {
                const url = await window.entropy.fs.toUrl(absolute);
                const ext = info.extension.toLowerCase();
                if ([".mp4", ".webm", ".mov", ".mkv", ".m4v"].includes(ext)) {
                  const imgTag = new RegExp(
                    `<img([^>]*?)src=["']${escapeRegExp(raw)}["']([^>]*)/?>`,
                    "gi",
                  );
                  rendered = rendered.replace(
                    imgTag,
                    `<video$1src="${url}"$2 muted playsinline controls preload="metadata"></video>`,
                  );
                }
                rendered = rendered.split(`"${raw}"`).join(`"${url}"`);
                rendered = rendered.split(`'${raw}'`).join(`'${url}'`);
              }
            } catch {
              // Keep original.
            }
          }
        } catch {
          // Keep unmarked HTML.
        }
      }

      // Neutralize remaining relative hrefs so Electron never navigates the shell.
      rendered = rendered.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (_all, pre, href, post) => {
        if (/^(https?:|mailto:|#|entropy:)/i.test(href)) {
          return `<a ${pre}href="${href}"${post} target="_blank" rel="noreferrer">`;
        }
        const absolute = map.get(href);
        const safe = absolute
          ? `href="#" data-entropy-path="${encodeURIComponent(absolute)}"`
          : `href="#" data-entropy-missing="1"`;
        return `<a ${pre}${safe}${post}>`;
      });

      if (!cancelled) {
        localMap.current = map;
        setHtml(rendered);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [content, notePath, workspace.path, diskEpoch]);

  function onClick(event: MouseEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a");
    if (!anchor) return;

    event.preventDefault();
    event.stopPropagation();

    const missing = anchor.getAttribute("data-entropy-missing");
    if (missing) return;

    const encoded = anchor.getAttribute("data-entropy-path");
    if (encoded) {
      onOpenLocal?.(decodeURIComponent(encoded));
      return;
    }

    const href = anchor.getAttribute("href");
    if (href && /^https?:/i.test(href)) {
      void window.entropy.fs.openExternal(href);
    }
  }

  return (
    <div
      className={cn(
        "markdown-preview select-text entropy-prose-pad mx-auto w-full max-w-[720px] pb-16 pt-2 text-[15px] leading-7 text-foreground",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={onClick}
    />
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
