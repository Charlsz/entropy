import { FileText } from "lucide-react";
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
import { figma } from "../lib/figmaTokens";
import {
  embedKind,
  joinMarkdownBlocks,
  parseMarkdownBlocks,
  type MarkdownBlock,
} from "../lib/markdownBlocks";
import { useWorkspace } from "../state/useWorkspace";

export interface LiveMarkdownEditorHandle {
  insertMarkdown: (markdown: string) => void;
  focus: (options?: { at?: "start" | "end" }) => void;
}

interface LiveMarkdownEditorProps {
  value: string;
  notePath?: string | null;
  /** Workspace disk changes — re-resolve embeds when files appear/disappear. */
  diskEpoch?: number;
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

function countFaces(blocks: MarkdownBlock[]): number {
  return blocks.reduce(
    (n, block) => n + (block.type === "media" || block.type === "fileRef" ? 1 : 0),
    0,
  );
}

function isFaceBlock(
  block: MarkdownBlock | undefined,
): block is Extract<MarkdownBlock, { type: "media" | "fileRef" }> {
  return block?.type === "media" || block?.type === "fileRef";
}

/**
 * Writing surface: markdown source stays editable text.
 * Standalone ![…](…) lines get an Obsidian-style live face until you click them
 * (then the raw markdown returns so you can edit/delete like any other line).
 */
export const LiveMarkdownEditor = forwardRef<LiveMarkdownEditorHandle, LiveMarkdownEditorProps>(
  function LiveMarkdownEditor(
    { value, notePath, diskEpoch = 0, disabled, className, onChange, onKeyDown, onDropPath },
    ref,
  ) {
    const { workspace } = useWorkspace();
    const blocks = useMemo(() => parseMarkdownBlocks(value), [value]);
    const activeTextIndex = useRef(0);
    const textRefs = useRef(new Map<number, HTMLTextAreaElement>());
    /** Media face opened as normal markdown source (no apply/cancel chrome). */
    const [openSourceIndex, setOpenSourceIndex] = useState<number | null>(null);
    const pendingCaret = useRef<"start" | "end" | number | null>(null);
    const sourceSelectAll = useRef(false);
    const undoStack = useRef<string[]>([]);
    const redoStack = useRef<string[]>([]);
    const applyingHistory = useRef(false);
    const knownValue = useRef(value);

    // External value changes (disk sync / note switch) reset typing history.
    useEffect(() => {
      if (applyingHistory.current) {
        knownValue.current = value;
        return;
      }
      if (value !== knownValue.current) {
        undoStack.current = [];
        redoStack.current = [];
        knownValue.current = value;
      }
    }, [value]);

    useEffect(() => {
      undoStack.current = [];
      redoStack.current = [];
      knownValue.current = value;
      // Reset when switching notes; `value` is the newly opened note content.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- only on notePath
    }, [notePath]);

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

    const commitBlocks = useCallback(
      (next: MarkdownBlock[]) => {
        const joined = joinMarkdownBlocks(next);
        if (joined === value) return;
        if (!applyingHistory.current) {
          const stack = undoStack.current;
          if (stack[stack.length - 1] !== value) {
            stack.push(value);
            if (stack.length > 400) stack.shift();
          }
          redoStack.current = [];
        }
        knownValue.current = joined;
        onChange(joined);
      },
      [onChange, value],
    );

    const applyHistoryValue = useCallback(
      (next: string) => {
        applyingHistory.current = true;
        knownValue.current = next;
        onChange(next);
        window.requestAnimationFrame(() => {
          applyingHistory.current = false;
          focusText(firstTextBlockIndex(parseMarkdownBlocks(next), true), "end");
        });
      },
      [focusText, onChange],
    );

    const undo = useCallback(() => {
      if (disabled || undoStack.current.length === 0) return;
      const prev = undoStack.current.pop()!;
      redoStack.current.push(value);
      applyHistoryValue(prev);
    }, [applyHistoryValue, disabled, value]);

    const redo = useCallback(() => {
      if (disabled || redoStack.current.length === 0) return;
      const next = redoStack.current.pop()!;
      undoStack.current.push(value);
      applyHistoryValue(next);
    }, [applyHistoryValue, disabled, value]);

    const handleHistoryKeys = useCallback(
      (event: KeyboardEvent<Element>): boolean => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
        const key = event.key.toLowerCase();
        if (key === "z" && !event.shiftKey) {
          event.preventDefault();
          undo();
          return true;
        }
        if (key === "y" || (key === "z" && event.shiftKey)) {
          event.preventDefault();
          redo();
          return true;
        }
        return false;
      },
      [redo, undo],
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

    const removeFaceAt = useCallback(
      (faceIndex: number) => {
        const current = parseMarkdownBlocks(value);
        if (!isFaceBlock(current[faceIndex])) return;

        const before = current[faceIndex - 1];
        const beforeText = before?.type === "text" ? before.value : "";
        const caret = beforeText.length;

        const next = mergeAdjacentText(current.filter((_, i) => i !== faceIndex));
        const parsed = parseMarkdownBlocks(joinMarkdownBlocks(next));
        commitBlocks(parsed);
        setOpenSourceIndex(null);

        window.requestAnimationFrame(() => {
          let textIndex = -1;
          for (let i = 0; i < parsed.length; i++) {
            if (parsed[i]?.type === "text" && i <= faceIndex) textIndex = i;
          }
          if (textIndex < 0) textIndex = firstTextBlockIndex(parsed, false);
          focusText(textIndex, caret);
        });
      },
      [commitBlocks, focusText, mergeAdjacentText, value],
    );

    /** Reveal face markdown as ordinary text (click / keyboard). */
    const openMediaAsSource = useCallback(
      (faceIndex: number) => {
        if (disabled) return;
        sourceSelectAll.current = true;
        setOpenSourceIndex(faceIndex);
        activeTextIndex.current = faceIndex;
        window.requestAnimationFrame(() => {
          const el = textRefs.current.get(faceIndex);
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
      (faceIndex: number, raw: string) => {
        const current = parseMarkdownBlocks(value);
        if (!isFaceBlock(current[faceIndex])) return;

        if (!raw.trim()) {
          removeFaceAt(faceIndex);
          return;
        }

        // Swap this face for whatever the new line parses as; keep source open if still a face.
        const next = current.map((block, i) =>
          i === faceIndex ? { type: "text" as const, value: raw } : block,
        );
        const parsed = parseMarkdownBlocks(joinMarkdownBlocks(next));
        commitBlocks(parsed);

        const stillFace = parsed.findIndex(
          (block, i) =>
            Math.abs(i - faceIndex) <= 1 &&
            isFaceBlock(block) &&
            block.raw.trimEnd() === raw.trimEnd(),
        );
        if (stillFace >= 0) {
          setOpenSourceIndex(stillFace);
          activeTextIndex.current = stillFace;
        } else {
          const textIdx = parsed.findIndex(
            (block, i) =>
              block.type === "text" &&
              Math.abs(i - faceIndex) <= 1 &&
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
      [commitBlocks, removeFaceAt, value],
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
        if (countFaces(parsed) > countFaces(before)) {
          let faceAfter = -1;
          for (let i = 0; i < parsed.length; i++) {
            if (i >= blockIndex && isFaceBlock(parsed[i])) {
              faceAfter = i;
              break;
            }
            if (isFaceBlock(parsed[i])) faceAfter = i;
          }
          const follow = parsed.findIndex(
            (block, i) => i > faceAfter && block.type === "text",
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
          if (isFaceBlock(prev)) {
            event.preventDefault();
            removeFaceAt(blockIndex - 1);
            return;
          }
        }

        if (event.key === "Delete" && atEnd) {
          const next = blocks[blockIndex + 1];
          if (isFaceBlock(next)) {
            event.preventDefault();
            removeFaceAt(blockIndex + 1);
          }
        }
      },
      [blocks, disabled, onKeyDown, removeFaceAt],
    );

    return (
      <div
        className={cn(
          "select-text entropy-prose-pad mb-8 flex min-h-full w-full flex-1 flex-col gap-3 pb-16",
          className,
        )}
        onDragOver={(event) => event.preventDefault()}
        onKeyDownCapture={(event) => {
          if (disabled) return;
          handleHistoryKeys(event);
        }}
        onMouseDown={(event) => {
          if (disabled) return;
          const target = event.target as HTMLElement;
          if (target.closest("textarea, a, input, iframe, video, img, figure, button.entropy-file-ref"))
            return;
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

          if (openSourceIndex === index && isFaceBlock(block)) {
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
                aria-label={block.type === "fileRef" ? "File reference source" : "Markdown media source"}
                onFocus={() => {
                  activeTextIndex.current = index;
                }}
                onChange={(event) => {
                  activeTextIndex.current = index;
                  updateOpenSource(index, event.target.value);
                  autoResize(event.target);
                }}
                onBlur={() => {
                  setOpenSourceIndex((current) => (current === index ? null : current));
                }}
                onKeyDown={(event) => {
                  onKeyDown?.(event);
                  if (event.key === "Backspace" && !event.currentTarget.value) {
                    event.preventDefault();
                    removeFaceAt(index);
                  }
                }}
              />
            );
          }

          if (block.type === "fileRef") {
            return (
              <FileRefChip
                key={`file-${index}-${block.src}`}
                label={block.label}
                src={block.src}
                disabled={disabled}
                onOpenSource={() => openMediaAsSource(index)}
                onRemove={() => removeFaceAt(index)}
              />
            );
          }

          return (
            <MediaFace
              key={`media-${index}-${block.src}`}
              alt={block.alt}
              src={block.src}
              notePath={notePath}
              workspacePath={workspace.path}
              diskEpoch={diskEpoch}
              disabled={disabled}
              onOpenSource={() => openMediaAsSource(index)}
              onRemove={() => removeFaceAt(index)}
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
  workspacePath?: string | null;
  diskEpoch?: number;
  disabled?: boolean;
  onOpenSource: () => void;
  onRemove: () => void;
}

function MediaFace({
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

function FileRefChip({
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
