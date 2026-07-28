import { useEffect, useState } from "react";
import { marked } from "marked";
import { cn } from "../lib/utils";

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
  className?: string;
}

const SRC_RE = /\b(?:src|href)=["']([^"']+)["']/gi;

export function MarkdownPreview({ content, notePath, className }: MarkdownPreviewProps) {
  const [html, setHtml] = useState("<p></p>");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let rendered: string;
      try {
        rendered = marked.parse(content, { async: false }) as string;
      } catch {
        rendered = "<p>Could not render this note.</p>";
      }

      if (notePath) {
        try {
          const noteDir = await window.entropy.fs.dirname(notePath);
          const replacements = new Map<string, string>();
          SRC_RE.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = SRC_RE.exec(rendered)) !== null) {
            const raw = match[1];
            if (!raw || /^(https?:|data:|entropy:|mailto:|#)/i.test(raw)) continue;
            if (replacements.has(raw)) continue;
            try {
              const absolute = await window.entropy.fs.join(noteDir, raw);
              if (!(await window.entropy.fs.exists(absolute))) continue;
              const info = await window.entropy.fs.stat(absolute);
              if (info.isDirectory) continue;
              replacements.set(raw, await window.entropy.fs.toUrl(absolute));
            } catch {
              // Keep original path.
            }
          }
          for (const [from, to] of replacements) {
            rendered = rendered.split(from).join(to);
          }
        } catch {
          // Keep unmarked HTML.
        }
      }

      if (!cancelled) setHtml(rendered);
    })();

    return () => {
      cancelled = true;
    };
  }, [content, notePath]);

  return (
    <div
      className={cn(
        "markdown-preview select-text mx-auto w-full max-w-[720px] px-8 pb-16 pt-2 text-[15px] leading-7 text-foreground",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
