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
  mediaMarkdown,
  parseMarkdownBlocks,
  type MarkdownBlock,
} from "../lib/markdownBlocks";

export interface LiveMarkdownEditorHandle {
  insertMarkdown: (markdown: string) => void;
  focus: () => void;
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

export const LiveMarkdownEditor = forwardRef<LiveMarkdownEditorHandle, LiveMarkdownEditorProps>(
  function LiveMarkdownEditor(
    { value, notePath, disabled, className, onChange, onKeyDown, onDropPath },
    ref,
  ) {
    const blocks = useMemo(() => parseMarkdownBlocks(value), [value]);
    const activeTextIndex = useRef(0);
    const textRefs = useRef(new Map<number, HTMLTextAreaElement>());
    const [editingMedia, setEditingMedia] = useState<number | null>(null);

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
        // Re-parse after join so typed media lines become embeds.
        commitBlocks(parseMarkdownBlocks(joinMarkdownBlocks(next)));
      },
      [commitBlocks, value],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          const el =
            textRefs.current.get(activeTextIndex.current) ??
            textRefs.current.values().next().value ??
            null;
          el?.focus();
        },
        insertMarkdown(markdown: string) {
          const index = activeTextIndex.current;
          const el = textRefs.current.get(index);
          const current = parseMarkdownBlocks(value);
          const block = current[index];

          if (el && block?.type === "text" && document.activeElement === el) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const nextText = `${block.value.slice(0, start)}${markdown}${block.value.slice(end)}`;
            const next = current.map((item, i) =>
              i === index && item.type === "text" ? { ...item, value: nextText } : item,
            );
            commitBlocks(parseMarkdownBlocks(joinMarkdownBlocks(next)));
            const cursor = start + markdown.length;
            window.requestAnimationFrame(() => {
              const area = textRefs.current.get(index);
              if (!area) return;
              area.focus();
              area.setSelectionRange(cursor, cursor);
              autoResize(area);
            });
            return;
          }

          const pad = value && !value.endsWith("\n") ? "\n\n" : value ? "\n" : "";
          commitBlocks(parseMarkdownBlocks(`${value}${pad}${markdown}`));
        },
      }),
      [commitBlocks, value],
    );

    useEffect(() => {
      for (const el of textRefs.current.values()) autoResize(el);
    }, [blocks]);

    return (
      <div
        className={cn(
          "select-text mb-8 flex min-h-0 w-full flex-1 flex-col gap-3 px-8 pb-16",
          className,
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const entropyPath = event.dataTransfer.getData("application/x-entropy-path");
          if (entropyPath) onDropPath?.(entropyPath);
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
                className="min-h-[1.75rem] w-full resize-none overflow-hidden rounded-none border-0 bg-transparent p-0 font-sans text-[15px] leading-7 shadow-none focus-visible:ring-0"
                value={block.value}
                disabled={disabled}
                spellCheck
                aria-label="Markdown editor"
                onFocus={() => {
                  activeTextIndex.current = index;
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
      <div className="rounded-lg border border-border bg-ink-2/40 p-3">
        <Textarea
          className="min-h-[2.5rem] w-full resize-none border-border bg-transparent font-mono text-sm"
          value={draft}
          disabled={disabled}
          autoFocus
          aria-label="Edit media markdown"
          onChange={(event) => setDraft(event.target.value)}
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

  return (
    <figure className="group relative my-1">
      <button
        type="button"
        className="absolute right-2 top-2 z-10 hidden rounded-md bg-ink/80 px-2 py-1 text-[11px] text-paper group-hover:block"
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
            Missing media: {src}
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
      {alt ? (
        <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">{alt}</figcaption>
      ) : null}
    </figure>
  );
}
