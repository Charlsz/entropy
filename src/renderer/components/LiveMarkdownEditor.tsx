import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils";
import {
  embedKind,
  joinMarkdownBlocks,
  parseMarkdownBlocks,
  type MarkdownBlock,
} from "../lib/markdownBlocks";

export interface LiveMarkdownEditorHandle {
  insertMarkdown: (markdown: string) => void;
  focus: (options?: { at?: "start" | "end" }) => void;
}

interface LiveMarkdownEditorProps {
  value: string;
  notePath?: string | null;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onDropPath?: (absolutePath: string) => void;
}

function autoResize(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
}

function firstTextBlockIndex(blocks: MarkdownBlock[], fromEnd: boolean): number {
  const indices = blocks
    .map((block, index) => (block.type === "text" ? index : -1))
    .filter((index) => index >= 0);
  if (indices.length === 0) return 0;
  return fromEnd ? indices[indices.length - 1]! : indices[0]!;
}

function countMedia(blocks: MarkdownBlock[]): number {
  return blocks.reduce((n, block) => n + (block.type === "media" ? 1 : 0), 0);
}

/**
 * Writing surface: markdown source stays editable text.
 * Standalone ![…](…) lines get an Obsidian-style live face until you click them
 * (then the raw markdown returns so you can edit/delete like any other line).
 */
export const LiveMarkdownEditor = forwardRef<LiveMarkdownEditorHandle, LiveMarkdownEditorProps>(
  function LiveMarkdownEditor(
    { value, notePath, disabled, className, onChange, onKeyDown, onDropPath },
    ref,
  ) {
    const blocks = useMemo(() => parseMarkdownBlocks(value), [value]);
    const activeTextIndex = useRef(0);
    const textRefs = useRef(new Map<number, HTMLTextAreaElement>());
    /** Media face opened as normal markdown source (no apply/cancel chrome). */
    const [openSourceIndex, setOpenSourceIndex] = useState<number | null>(null);
    const pendingCaret = useRef<"start" | "end" | number | null>(null);
    const sourceSelectAll = useRef(false);

    const commitBlocks = useCallback(
      (next: MarkdownBlock[]) => {
        onChange(joinMarkdownBlocks(next));
      },
      [onChange],
    );

    const focusText = useCallback(
      (index: number, at: "start" | "end" | number = "end") => {
        if (disabled) return;
        activeTextIndex.current = index;
        pendingCaret.current = at;
        setOpenSourceIndex(null);
        window.requestAnimationFrame(() => {
          const el = textRefs.current.get(index);
          if (!el) return;
          const caret = pendingCaret.current;
          pendingCaret.current = null;
          el.focus();
          const pos =
            caret === "start" ? 0 : typeof caret === "number" ? caret : el.value.length;
          el.setSelectionRange(pos, pos);
          autoResize(el);
        });
      },
      [disabled],
    );

    const mergeAdjacentText = useCallback((items: MarkdownBlock[]): MarkdownBlock[] => {
      const merged: MarkdownBlock[] = [];
      for (const block of items) {
        const prev = merged[merged.length - 1];
        if (block.type === "text" && prev?.type === "text") {
          const sep = prev.value && block.value ? "\n" : "";
          merged[merged.length - 1] = {
            type: "text",
            value: `${prev.value}${sep}${block.value}`,
          };
        } else {
          merged.push(block);
        }
      }
      return merged.length ? merged : [{ type: "text", value: "" }];
    }, []);

    const removeMediaAt = useCallback(
      (mediaIndex: number) => {
        const current = parseMarkdownBlocks(value);
        if (current[mediaIndex]?.type !== "media") return;

        const before = current[mediaIndex - 1];
        const beforeText = before?.type === "text" ? before.value : "";
        const caret = beforeText.length;

        const next = mergeAdjacentText(current.filter((_, i) => i !== mediaIndex));
        const parsed = parseMarkdownBlocks(joinMarkdownBlocks(next));
        commitBlocks(parsed);
        setOpenSourceIndex(null);

        window.requestAnimationFrame(() => {
          let textIndex = -1;
          for (let i = 0; i < parsed.length; i++) {
            if (parsed[i]?.type === "text" && i <= mediaIndex) textIndex = i;
          }
          if (textIndex < 0) textIndex = firstTextBlockIndex(parsed, false);
          focusText(textIndex, caret);
        });
      },
      [commitBlocks, focusText, mergeAdjacentText, value],
    );

    /** Reveal ![…](…) as ordinary markdown text (click / keyboard). */
    const openMediaAsSource = useCallback(
      (mediaIndex: number) => {
        if (disabled) return;
        sourceSelectAll.current = true;
        setOpenSourceIndex(mediaIndex);
        activeTextIndex.current = mediaIndex;
        window.requestAnimationFrame(() => {
          const el = textRefs.current.get(mediaIndex);
          if (!el) return;
          el.focus();
          if (sourceSelectAll.current) {
            el.select();
            sourceSelectAll.current = false;
          }
          autoResize(el);
        });
      },
      [disabled],
    );

    const updateOpenSource = useCallback(
      (mediaIndex: number, raw: string) => {
        const current = parseMarkdownBlocks(value);
        if (current[mediaIndex]?.type !== "media") return;

        if (!raw.trim()) {
          removeMediaAt(mediaIndex);
          return;
        }

        // Swap this face for whatever the new line parses as; keep source open if still a face.
        const next = current.map((block, i) =>
          i === mediaIndex ? { type: "text" as const, value: raw } : block,
        );
        const parsed = parseMarkdownBlocks(joinMarkdownBlocks(next));
        commitBlocks(parsed);

        const stillMedia = parsed.findIndex(
          (block, i) =>
            Math.abs(i - mediaIndex) <= 1 &&
            block.type === "media" &&
            block.raw.trimEnd() === raw.trimEnd(),
        );
        if (stillMedia >= 0) {
          setOpenSourceIndex(stillMedia);
          activeTextIndex.current = stillMedia;
        } else {
          // Syntax broken / multi-line — it's normal text now.
          const textIdx = parsed.findIndex(
            (block, i) =>
              block.type === "text" &&
              Math.abs(i - mediaIndex) <= 1 &&
              block.value.includes(raw.trimEnd()),
          );
          setOpenSourceIndex(null);
          if (textIdx >= 0) {
            activeTextIndex.current = textIdx;
            window.requestAnimationFrame(() => {
              const el = textRefs.current.get(textIdx);
              if (!el) return;
              el.focus();
              const pos = el.value.length;
              el.setSelectionRange(pos, pos);
              autoResize(el);
            });
          }
        }
      },
      [commitBlocks, removeMediaAt, value],
    );

    const updateTextBlock = useCallback(
      (blockIndex: number, text: string) => {
        const before = parseMarkdownBlocks(value);
        const next = before.map((block, index) =>
          index === blockIndex && block.type === "text" ? { ...block, value: text } : block,
        );
        const parsed = parseMarkdownBlocks(joinMarkdownBlocks(next));
        commitBlocks(parsed);

        // New live faces: leave caret after them so Backspace removes like a block.
        if (countMedia(parsed) > countMedia(before)) {
          let mediaAfter = -1;
          for (let i = 0; i < parsed.length; i++) {
            if (i >= blockIndex && parsed[i]?.type === "media") {
              mediaAfter = i;
              break;
            }
            if (parsed[i]?.type === "media") mediaAfter = i;
          }
          const follow = parsed.findIndex(
            (block, i) => i > mediaAfter && block.type === "text",
          );
          if (follow >= 0) {
            window.requestAnimationFrame(() => focusText(follow, "start"));
          }
        }
      },
      [commitBlocks, focusText, value],
    );

    useEffect(() => {
      for (const el of textRefs.current.values()) autoResize(el);
    }, [blocks, openSourceIndex]);

    useImperativeHandle(
      ref,
      () => ({
        focus(options) {
          const at = options?.at ?? "end";
          focusText(firstTextBlockIndex(blocks, at === "end"), at);
        },
        insertMarkdown(markdown: string) {
          const trimmed = markdown.trim();
          const asBlock = trimmed.startsWith("![");
          const index = activeTextIndex.current;
          const el = textRefs.current.get(index);
          const current = parseMarkdownBlocks(value);
          const block = current[index];

          if (el && block?.type === "text" && document.activeElement === el && !asBlock) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const nextText = `${block.value.slice(0, start)}${trimmed}${block.value.slice(end)}`;
            const next = current.map((item, i) =>
              i === index && item.type === "text" ? { ...item, value: nextText } : item,
            );
            commitBlocks(parseMarkdownBlocks(joinMarkdownBlocks(next)));
            window.requestAnimationFrame(() => {
              const area = textRefs.current.get(index);
              if (!area) return;
              const cursor = start + trimmed.length;
              area.focus();
              area.setSelectionRange(cursor, cursor);
              autoResize(area);
            });
            return;
          }

          if (asBlock) {
            const body = value.replace(/\s+$/, "");
            const pad = body ? "\n\n" : "";
            const nextValue = `${body}${pad}${trimmed}\n`;
            commitBlocks(parseMarkdownBlocks(nextValue));
            window.requestAnimationFrame(() => {
              focusText(firstTextBlockIndex(parseMarkdownBlocks(nextValue), true), "end");
            });
            return;
          }

          const pad = value && !value.endsWith("\n") ? "\n\n" : value ? "\n" : "";
          const nextValue = `${value}${pad}${trimmed}`;
          commitBlocks(parseMarkdownBlocks(nextValue));
          window.requestAnimationFrame(() => {
            focusText(firstTextBlockIndex(parseMarkdownBlocks(nextValue), true), "end");
          });
        },
      }),
      [blocks, commitBlocks, focusText, value],
    );

    const handleTextKeyDown = useCallback(
      (blockIndex: number, event: KeyboardEvent<HTMLTextAreaElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || disabled) return;

        const el = event.currentTarget;
        const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
        const atEnd =
          el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

        if (event.key === "Backspace" && atStart) {
          const prev = blocks[blockIndex - 1];
          if (prev?.type === "media") {
            event.preventDefault();
            removeMediaAt(blockIndex - 1);
            return;
          }
        }

        if (event.key === "Delete" && atEnd) {
          const next = blocks[blockIndex + 1];
          if (next?.type === "media") {
            event.preventDefault();
            removeMediaAt(blockIndex + 1);
          }
        }
      },
      [blocks, disabled, onKeyDown, removeMediaAt],
    );

    return (
      <div
        className={cn(
          "select-text entropy-prose-pad mb-8 flex min-h-full w-full flex-1 flex-col gap-3 pb-16",
          className,
        )}
        onDragOver={(event) => event.preventDefault()}
        onMouseDown={(event) => {
          if (disabled) return;
          const target = event.target as HTMLElement;
          if (target.closest("textarea, a, input, iframe, video, img, figure")) return;
          event.preventDefault();
          focusText(firstTextBlockIndex(blocks, true), "end");
        }}
        onDrop={(event) => {
          event.preventDefault();
          const entropyPath = event.dataTransfer.getData("application/x-entropy-path");
          if (entropyPath) {
            onDropPath?.(entropyPath);
            return;
          }
          const dropped = event.dataTransfer.files?.[0] as (File & { path?: string }) | undefined;
          if (dropped?.path) onDropPath?.(dropped.path);
        }}
      >
        {blocks.map((block, index) => {
          if (block.type === "text") {
            return (
              <Textarea
                key={`text-${index}`}
                ref={(el) => {
                  if (el) textRefs.current.set(index, el);
                  else textRefs.current.delete(index);
                }}
                className="min-h-[1.75rem] w-full resize-none overflow-hidden rounded-none border-0 bg-transparent p-0 font-sans text-[15px] font-normal leading-[1.7] shadow-none focus-visible:ring-0"
                value={block.value}
                disabled={disabled}
                spellCheck
                aria-label="Markdown editor"
                onFocus={() => {
                  activeTextIndex.current = index;
                  setOpenSourceIndex(null);
                }}
                onChange={(event) => {
                  activeTextIndex.current = index;
                  updateTextBlock(index, event.target.value);
                  autoResize(event.target);
                }}
                onKeyDown={(event) => handleTextKeyDown(index, event)}
              />
            );
          }

          if (openSourceIndex === index) {
            return (
              <Textarea
                key={`source-${index}`}
                ref={(el) => {
                  if (el) textRefs.current.set(index, el);
                  else textRefs.current.delete(index);
                }}
                className="min-h-[1.75rem] w-full resize-none overflow-hidden rounded-none border-0 bg-transparent p-0 font-sans text-[15px] font-normal leading-[1.7] shadow-none focus-visible:ring-0"
                value={block.raw}
                disabled={disabled}
                spellCheck={false}
                aria-label="Markdown media source"
                onFocus={() => {
                  activeTextIndex.current = index;
                }}
                onChange={(event) => {
                  activeTextIndex.current = index;
                  updateOpenSource(index, event.target.value);
                  autoResize(event.target);
                }}
                onBlur={() => {
                  // Leave the line → live face returns if syntax is still a media embed.
                  setOpenSourceIndex((current) => (current === index ? null : current));
                }}
                onKeyDown={(event) => {
                  onKeyDown?.(event);
                  if (event.key === "Backspace" && !event.currentTarget.value) {
                    event.preventDefault();
                    removeMediaAt(index);
                  }
                }}
              />
            );
          }

          return (
            <MediaFace
              key={`media-${index}-${block.src}`}
              alt={block.alt}
              src={block.src}
              notePath={notePath}
              disabled={disabled}
              onOpenSource={() => openMediaAsSource(index)}
              onRemove={() => removeMediaAt(index)}
            />
          );
        })}
      </div>
    );
  },
);

interface MediaFaceProps {
  alt: string;
  src: string;
  notePath?: string | null;
  disabled?: boolean;
  onOpenSource: () => void;
  onRemove: () => void;
}

function MediaFace({ alt, src, notePath, disabled, onOpenSource, onRemove }: MediaFaceProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const kind = embedKind(src);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (/^(https?:|data:|entropy:)/i.test(src)) {
        if (!cancelled) {
          setUrl(src);
          setMissing(false);
        }
        return;
      }

      if (!notePath) {
        if (!cancelled) {
          setUrl(null);
          setMissing(true);
        }
        return;
      }

      try {
        let absolute = src;
        if (!/^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(src)) {
          const noteDir = await window.entropy.fs.dirname(notePath);
          absolute = await window.entropy.fs.join(noteDir, src);
        }
        if (!(await window.entropy.fs.exists(absolute))) {
          if (!cancelled) {
            setUrl(null);
            setMissing(true);
          }
          return;
        }
        const next = await window.entropy.fs.toUrl(absolute);
        if (!cancelled) {
          setUrl(next);
          setMissing(false);
        }
      } catch {
        if (!cancelled) {
          setUrl(null);
          setMissing(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notePath, src]);

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
