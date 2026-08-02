import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from "react";
import { marked } from "marked";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils";
import {
  embedKind,
  joinMarkdownBlocks,
  mediaMarkdown,
  parseMarkdownBlocks,
  type MarkdownBlock,
} from "../lib/markdownBlocks";

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
  onOpenLocal?: (absolutePath: string) => void;
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
 * Obsidian-style Live Preview: blocks render as HTML; the active block shows
 * Markdown source. Embeds show as faces until clicked for source edit.
 */
export const LiveMarkdownEditor = forwardRef<LiveMarkdownEditorHandle, LiveMarkdownEditorProps>(
  function LiveMarkdownEditor(
    { value, notePath, disabled, className, onChange, onKeyDown, onDropPath, onOpenLocal },
    ref,
  ) {
    const blocks = useMemo(() => parseMarkdownBlocks(value), [value]);
    const activeTextIndex = useRef(0);
    const textRefs = useRef(new Map<number, HTMLTextAreaElement>());
    const mediaSourceRef = useRef<HTMLTextAreaElement | null>(null);
    const [sourceIndex, setSourceIndex] = useState<number | null>(null);
    const pendingCaret = useRef<"start" | "end" | number | null>("end");

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

    const beginSource = useCallback((index: number, at: "start" | "end" | number = "end") => {
      if (disabled) return;
      activeTextIndex.current = index;
      pendingCaret.current = at;
      setSourceIndex(index);
    }, [disabled]);

    const leaveSourceIfIdle = useCallback((blurredIndex: number) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const active = document.activeElement;
          if (active instanceof HTMLTextAreaElement) {
            if (
              [...textRefs.current.values()].includes(active) ||
              active === mediaSourceRef.current
            ) {
              return;
            }
          }
          setSourceIndex((current) => (current === blurredIndex ? null : current));
        });
      });
    }, []);

    useEffect(() => {
      if (sourceIndex === null) return;
      const block = blocks[sourceIndex];
      if (!block) {
        setSourceIndex(null);
        return;
      }

      const at = pendingCaret.current;
      pendingCaret.current = null;

      window.requestAnimationFrame(() => {
        if (block.type === "text") {
          const el = textRefs.current.get(sourceIndex);
          if (!el) return;
          el.focus();
          const pos =
            at === "start" ? 0 : typeof at === "number" ? at : el.value.length;
          el.setSelectionRange(pos, pos);
          autoResize(el);
          return;
        }
        const el = mediaSourceRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        autoResize(el);
      });
    }, [sourceIndex, blocks]);

    useImperativeHandle(
      ref,
      () => ({
        focus(options) {
          const at = options?.at ?? "end";
          const index = firstTextBlockIndex(blocks, at === "end");
          beginSource(index, at);
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
            pendingCaret.current = start + trimmed.length;
            setSourceIndex(index);
            return;
          }

          if (asBlock) {
            const body = value.replace(/\s+$/, "");
            const pad = body ? "\n\n" : "";
            commitBlocks(parseMarkdownBlocks(`${body}${pad}${trimmed}\n`));
            window.requestAnimationFrame(() => {
              const nextBlocks = parseMarkdownBlocks(
                joinMarkdownBlocks(parseMarkdownBlocks(`${body}${pad}${trimmed}\n`)),
              );
              beginSource(firstTextBlockIndex(nextBlocks, true), "end");
            });
            return;
          }

          const pad = value && !value.endsWith("\n") ? "\n\n" : value ? "\n" : "";
          const nextValue = `${value}${pad}${trimmed}`;
          commitBlocks(parseMarkdownBlocks(nextValue));
          window.requestAnimationFrame(() => {
            beginSource(firstTextBlockIndex(parseMarkdownBlocks(nextValue), true), "end");
          });
        },
      }),
      [beginSource, blocks, commitBlocks, value],
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
          if (target.closest("textarea, button, a, input, iframe, video, img, figure, .live-preview-face")) {
            return;
          }
          event.preventDefault();
          beginSource(firstTextBlockIndex(blocks, true), "end");
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
            const editing = sourceIndex === index;
            if (editing) {
              return (
                <Textarea
                  key={`text-source-${index}`}
                  ref={(el) => {
                    if (el) textRefs.current.set(index, el);
                    else textRefs.current.delete(index);
                  }}
                  className="min-h-[1.75rem] w-full resize-none overflow-hidden rounded-none border-0 bg-transparent p-0 font-sans text-[15px] leading-7 shadow-none focus-visible:ring-0"
                  value={block.value}
                  disabled={disabled}
                  spellCheck
                  aria-label="Markdown source"
                  onFocus={() => {
                    activeTextIndex.current = index;
                  }}
                  onBlur={() => leaveSourceIfIdle(index)}
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
              <RenderedTextBlock
                key={`text-face-${index}`}
                content={block.value}
                notePath={notePath}
                disabled={disabled}
                onActivate={() => beginSource(index, "end")}
                onOpenLocal={onOpenLocal}
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
              editing={sourceIndex === index}
              disabled={disabled}
              sourceRef={mediaSourceRef}
              onEdit={() => beginSource(index, "end")}
              onCancelEdit={() => setSourceIndex(null)}
              onBlurSource={() => leaveSourceIfIdle(index)}
              onCommitRaw={(raw) => {
                const next = parseMarkdownBlocks(value).map((item, i) => {
                  if (i !== index) return item;
                  const trimmed = raw.trimEnd();
                  const parsed = parseMarkdownBlocks(trimmed);
                  return parsed[0] ?? { type: "text" as const, value: raw };
                });
                commitBlocks(parseMarkdownBlocks(joinMarkdownBlocks(next)));
                setSourceIndex(null);
              }}
              onRemove={() => {
                const next = parseMarkdownBlocks(value).filter((_, i) => i !== index);
                commitBlocks(next.length ? next : [{ type: "text", value: "" }]);
                setSourceIndex(null);
              }}
            />
          );
        })}
      </div>
    );
  },
);

function RenderedTextBlock({
  content,
  notePath,
  disabled,
  onActivate,
  onOpenLocal,
}: {
  content: string;
  notePath?: string | null;
  disabled?: boolean;
  onActivate: () => void;
  onOpenLocal?: (absolutePath: string) => void;
}) {
  const [html, setHtml] = useState("");
  const localMap = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const source = content.trim() ? content : "";
      let rendered: string;
      try {
        rendered = source
          ? (marked.parse(source, { async: false }) as string)
          : "<p class=\"live-preview-empty\"> </p>";
      } catch {
        rendered = "<p>Could not render.</p>";
      }

      const map = new Map<string, string>();
      if (notePath) {
        try {
          const noteDir = await window.entropy.fs.dirname(notePath);
          const attrRe = /\b(?:src|href)=["']([^"']+)["']/gi;
          let match: RegExpExecArray | null;
          const seen = new Set<string>();
          while ((match = attrRe.exec(rendered)) !== null) {
            const raw = match[1];
            if (!raw || /^(https?:|data:|entropy:|mailto:|#)/i.test(raw)) continue;
            if (seen.has(raw)) continue;
            seen.add(raw);
            try {
              const absolute = /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(raw)
                ? raw
                : await window.entropy.fs.join(noteDir, raw);
              if (!(await window.entropy.fs.exists(absolute))) continue;
              map.set(raw, absolute);
              const url = await window.entropy.fs.toUrl(absolute);
              rendered = rendered.split(`"${raw}"`).join(`"${url}"`);
              rendered = rendered.split(`'${raw}'`).join(`'${url}'`);
            } catch {
              // keep
            }
          }
        } catch {
          // keep
        }
      }

      rendered = rendered.replace(
        /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi,
        (_all, pre, href, post) => {
          if (/^(https?:|mailto:|#|entropy:)/i.test(href)) {
            return `<a ${pre}href="${href}"${post} target="_blank" rel="noreferrer">`;
          }
          const absolute = map.get(href);
          const safe = absolute
            ? `href="#" data-entropy-path="${encodeURIComponent(absolute)}"`
            : `href="#" data-entropy-missing="1"`;
          return `<a ${pre}${safe}${post}>`;
        },
      );

      if (!cancelled) {
        localMap.current = map;
        setHtml(rendered);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, notePath]);

  function onClick(event: ReactMouseEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a");
    if (anchor) {
      event.preventDefault();
      event.stopPropagation();
      if (anchor.getAttribute("data-entropy-missing")) return;
      const encoded = anchor.getAttribute("data-entropy-path");
      if (encoded) {
        onOpenLocal?.(decodeURIComponent(encoded));
        return;
      }
      const href = anchor.getAttribute("href");
      if (href && /^https?:/i.test(href)) {
        void window.entropy.fs.openExternal(href);
      }
      return;
    }
    if (!disabled) onActivate();
  }

  return (
    <div
      role="textbox"
      tabIndex={disabled ? -1 : 0}
      aria-label="Markdown (click to edit)"
      className={cn(
        "markdown-preview live-preview-face min-h-[1.75rem] cursor-text text-[15px] leading-7 text-foreground",
        !content.trim() && "min-h-[2.5rem]",
      )}
      dangerouslySetInnerHTML={{ __html: html || "<p> </p>" }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
    />
  );
}

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
  onBlurSource: () => void;
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
  onBlurSource,
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
          className="min-h-[2.5rem] w-full resize-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
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
          onBlur={() => {
            onCommitRaw(draft.trim() ? draft : mediaMarkdown(alt, src));
            onBlurSource();
          }}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Enter to apply · Esc to cancel</p>
      </div>
    );
  }

  return (
    <figure className="live-preview-face group relative my-1">
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
        aria-label={alt ? `Edit media: ${alt}` : "Edit media embed"}
      >
        {missing || !url ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Missing: {src}
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
              title={alt || "PDF"}
              src={`${url}#toolbar=0&navpanes=0&view=FitH`}
              className="entropy-pdf-face__frame h-full border-0"
              tabIndex={-1}
            />
          </div>
        ) : kind === "image" ? (
          <img
            src={url}
            alt={alt || ""}
            className="max-h-[520px] w-full rounded-lg object-contain"
            draggable={false}
          />
        ) : (
          <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
            {alt || src}
          </div>
        )}
      </button>
      {alt && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(alt) ? (
        <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">{alt}</figcaption>
      ) : null}
    </figure>
  );
}
