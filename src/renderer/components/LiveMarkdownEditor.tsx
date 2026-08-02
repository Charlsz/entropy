import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils";
import {
  embedKind,
  joinMarkdownBlocks,
  mediaMarkdown,
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

/**
 * Writing surface: Markdown source for text, live faces for embedded files.
 * Full rendered reading is Reading View only (MarkdownEditor surface toggle).
 */
export const LiveMarkdownEditor = forwardRef<LiveMarkdownEditorHandle, LiveMarkdownEditorProps>(
  function LiveMarkdownEditor(
    { value, notePath, disabled, className, onChange, onKeyDown, onDropPath },
    ref,
  ) {
    const blocks = useMemo(() => parseMarkdownBlocks(value), [value]);
    const activeTextIndex = useRef(0);
    const textRefs = useRef(new Map<number, HTMLTextAreaElement>());
    const mediaSourceRef = useRef<HTMLTextAreaElement | null>(null);
    const [editingMedia, setEditingMedia] = useState<number | null>(null);
    const pendingCaret = useRef<"start" | "end" | number | null>(null);

    const commitBlocks = useCallback(
      (next: MarkdownBlock[]) => {
        onChange(joinMarkdownBlocks(next));
      },
      [onChange],
    );

    const updateTextBlock = useCallback(
      (blockIndex: number, text: string) => {
        const next = parseMarkdownBlocks(value).map((block, index) =>
          index === blockIndex && block.type === "text" ? { ...block, value: text } : block,
        );
        commitBlocks(parseMarkdownBlocks(joinMarkdownBlocks(next)));
      },
      [commitBlocks, value],
    );

    const focusText = useCallback(
      (index: number, at: "start" | "end" | number = "end") => {
        if (disabled) return;
        activeTextIndex.current = index;
        pendingCaret.current = at;
        setEditingMedia(null);
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

    useEffect(() => {
      for (const el of textRefs.current.values()) autoResize(el);
    }, [blocks]);

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
          if (target.closest("textarea, button, a, input, iframe, video, img, figure")) return;
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
                  setEditingMedia(null);
                }}
                onChange={(event) => {
                  activeTextIndex.current = index;
                  updateTextBlock(index, event.target.value);
                  autoResize(event.target);
                }}
                onKeyDown={onKeyDown}
              />
            );
          }

          return (
            <MediaEmbedBlock
              key={`media-${index}-${block.src}`}
              alt={block.alt}
              src={block.src}
              raw={block.raw}
              notePath={notePath}
              editing={editingMedia === index}
              disabled={disabled}
              sourceRef={mediaSourceRef}
              onEdit={() => setEditingMedia(index)}
              onCancelEdit={() => setEditingMedia(null)}
              onCommitRaw={(raw) => {
                const next = parseMarkdownBlocks(value).map((item, i) => {
                  if (i !== index) return item;
                  const trimmed = raw.trimEnd();
                  const parsed = parseMarkdownBlocks(trimmed);
                  return parsed[0] ?? { type: "text" as const, value: raw };
                });
                commitBlocks(parseMarkdownBlocks(joinMarkdownBlocks(next)));
                setEditingMedia(null);
              }}
              onRemove={() => {
                const next = parseMarkdownBlocks(value).filter((_, i) => i !== index);
                commitBlocks(next.length ? next : [{ type: "text", value: "" }]);
                setEditingMedia(null);
              }}
            />
          );
        })}
      </div>
    );
  },
);

interface MediaEmbedBlockProps {
  alt: string;
  src: string;
  raw: string;
  notePath?: string | null;
  editing: boolean;
  disabled?: boolean;
  sourceRef: MutableRefObject<HTMLTextAreaElement | null>;
  onEdit: () => void;
  onCancelEdit: () => void;
  onCommitRaw: (raw: string) => void;
  onRemove: () => void;
}

function MediaEmbedBlock({
  alt,
  src,
  raw,
  notePath,
  editing,
  disabled,
  sourceRef,
  onEdit,
  onCancelEdit,
  onCommitRaw,
  onRemove,
}: MediaEmbedBlockProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState(raw);
  const kind = embedKind(src);

  useEffect(() => {
    setDraft(raw);
  }, [raw]);

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

  if (editing) {
    return (
      <div className="rounded-lg bg-ink-2/40 p-3">
        <Textarea
          ref={(el) => {
            sourceRef.current = el;
          }}
          className="min-h-[2.5rem] w-full resize-none border-0 bg-transparent font-mono text-sm font-normal shadow-none focus-visible:ring-0"
          value={draft}
          disabled={disabled}
          aria-label="Edit media markdown"
          onChange={(event) => {
            setDraft(event.target.value);
            autoResize(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelEdit();
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onCommitRaw(draft.trim() ? draft : mediaMarkdown(alt, src));
            }
          }}
          onBlur={() => onCommitRaw(draft.trim() ? draft : mediaMarkdown(alt, src))}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Enter to apply · Esc to cancel</p>
      </div>
    );
  }

  const caption = fileLabel(alt, src);

  return (
    <figure className="group relative my-1">
      <button
        type="button"
        className="absolute right-2 top-2 z-10 rounded-md bg-ink/80 px-2 py-1 text-[11px] text-paper opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={onRemove}
        disabled={disabled}
      >
        Remove
      </button>
      <button
        type="button"
        className="block w-full overflow-hidden rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onEdit}
        disabled={disabled}
        aria-label={caption ? `Edit media: ${caption}` : "Edit media embed"}
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
      </button>
      {caption ? (
        <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/** Prefer the on-disk filename for embeds — not “Embedded PNG”. */
function fileLabel(alt: string, src: string): string {
  const fromSrc = src.split(/[/\\]/).pop() ?? src;
  const fromAlt = alt.trim();
  if (fromAlt && fromAlt !== src && !fromAlt.includes("/") && !fromAlt.includes("\\")) {
    // Alt that is already a bare filename (or short title) is fine; UUID-looking alts fall back to src name.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(fromAlt)) {
      return fromAlt;
    }
  }
  return fromSrc;
}
