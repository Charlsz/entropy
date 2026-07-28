import { useMemo } from "react";
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
  className?: string;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    try {
      return marked.parse(content, { async: false }) as string;
    } catch {
      return "<p>Could not render this note.</p>";
    }
  }, [content]);

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
