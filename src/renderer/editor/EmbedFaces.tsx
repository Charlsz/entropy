import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { embedKind } from "../lib/markdownBlocks";
import { figma } from "../lib/figmaTokens";

export interface MediaFaceProps {
  alt: string;
  src: string;
  notePath?: string | null;
  workspacePath?: string | null;
  diskEpoch?: number;
  disabled?: boolean;
  onOpenSource: () => void;
  onRemove: () => void;
}

/** Live media face for TipTap embeds (image / video / pdf). Click reveals markdown source. */
export function MediaFace({
  alt,
  src,
  notePath,
  workspacePath,
  diskEpoch = 0,
  disabled,
  onOpenSource,
  onRemove,
}: MediaFaceProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [missProbe, setMissProbe] = useState(0);
  const resolvedPath = useRef<string | null>(null);
  const kind = embedKind(src);

  // Keep looking for missing media without waiting for a directory-watch event.
  useEffect(() => {
    if (!missing) return;
    const timer = window.setInterval(() => setMissProbe((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [missing]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (/^(https?:|data:|entropy:)/i.test(src)) {
        resolvedPath.current = null;
        if (!cancelled) {
          setUrl(src);
          setMissing(false);
        }
        return;
      }

      if (!notePath) {
        resolvedPath.current = null;
        if (!cancelled) {
          setUrl(null);
          setMissing(true);
        }
        return;
      }

      try {
        let absolute = resolvedPath.current;
        if (absolute && (await window.entropy.fs.exists(absolute))) {
          // Keep previous resolution when the file is still there.
        } else {
          absolute = await window.entropy.fs.resolveEmbedTarget(
            src,
            notePath,
            workspacePath,
          );
        }

        if (!absolute) {
          resolvedPath.current = null;
          if (!cancelled) {
            setUrl(null);
            setMissing(true);
          }
          return;
        }

        resolvedPath.current = absolute;
        const next = await window.entropy.fs.toUrl(absolute);
        if (!cancelled) {
          setUrl(next);
          setMissing(false);
        }
      } catch {
        resolvedPath.current = null;
        if (!cancelled) {
          setUrl(null);
          setMissing(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notePath, src, workspacePath, diskEpoch, missProbe]);

  // Reset cached path when the markdown target changes.
  useEffect(() => {
    resolvedPath.current = null;
  }, [src, notePath]);

  const caption = fileLabel(alt, src);

  return (
    <figure
      className="relative my-1 cursor-text outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      tabIndex={disabled ? -1 : 0}
      aria-label={caption ? `Embedded media: ${caption}` : "Embedded media"}
      onClick={(event) => {
        if (disabled) return;
        // Allow native video controls without forcing source mode.
        if ((event.target as HTMLElement).closest("video")) return;
        onOpenSource();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          onRemove();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenSource();
        }
      }}
    >
      {missing || !url ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Missing: {caption || src}
        </div>
      ) : kind === "video" ? (
        <video
          src={url}
          className="max-h-[420px] w-full rounded-lg object-contain"
          controls
          muted
          playsInline
          preload="metadata"
        />
      ) : kind === "pdf" ? (
        <div className="entropy-pdf-face relative h-[min(28rem,50vh)] w-full overflow-hidden rounded-lg bg-ink-2">
          <iframe
            title={caption || "PDF"}
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            className="entropy-pdf-face__frame h-full border-0"
            tabIndex={-1}
          />
        </div>
      ) : kind === "image" ? (
        <img
          src={url}
          alt={caption || ""}
          className="max-h-[520px] w-full rounded-lg object-contain"
          draggable={false}
        />
      ) : (
        <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
          {caption || src}
        </div>
      )}
      {caption ? (
        <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export function FileRefChip({
  label,
  src,
  disabled,
  onOpenSource,
  onRemove,
}: {
  label: string;
  src: string;
  disabled?: boolean;
  onOpenSource: () => void;
  onRemove: () => void;
}) {
  const name = label.trim() || src.split(/[/\\]/).pop() || src;
  return (
    <button
      type="button"
      className="entropy-file-ref my-1 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
      style={{
        backgroundColor: figma.surface,
        borderColor: figma.border,
        color: figma.ink,
      }}
      disabled={disabled}
      aria-label={`File reference: ${name}`}
      title={src}
      onClick={() => {
        if (!disabled) onOpenSource();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          onRemove();
        }
      }}
    >
      <FileText className="size-3 shrink-0" style={{ color: figma.accent }} strokeWidth={1.75} />
      <span className="truncate font-mono text-[11px] leading-none">{name}</span>
    </button>
  );
}

function fileLabel(alt: string, src: string): string {
  const fromSrc = src.split(/[/\\]/).pop() ?? src;
  const fromAlt = alt.trim();
  if (fromAlt && fromAlt !== src && !fromAlt.includes("/") && !fromAlt.includes("\\")) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(fromAlt)) {
      return fromAlt;
    }
  }
  return fromSrc;
}
