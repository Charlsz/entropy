import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { Extension } from "@tiptap/core";
import { cn } from "../lib/utils";
import { EntropyFileRef, EntropyMedia } from "../editor/entropyEmbedExtensions";
import { markdownToTipTapDoc, tipTapDocToMarkdown } from "../editor/markdownDoc";
import { parseMarkdownBlocks } from "../lib/markdownBlocks";

export interface WysiwygMarkdownEditorHandle {
  insertMarkdown: (markdown: string) => void;
  focus: (options?: { at?: "start" | "end" }) => void;
}

interface WysiwygMarkdownEditorProps {
  value: string;
  notePath?: string | null;
  diskEpoch?: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  onDropPath?: (absolutePath: string) => void;
}

const EntropyNoteMeta = Extension.create({
  name: "entropyNoteMeta",
  addStorage() {
    return {
      notePath: null as string | null,
      diskEpoch: 0,
    };
  },
});

export const WysiwygMarkdownEditor = forwardRef<
  WysiwygMarkdownEditorHandle,
  WysiwygMarkdownEditorProps
>(function WysiwygMarkdownEditor(
  { value, notePath, diskEpoch = 0, disabled, className, onChange, onKeyDown, onDropPath },
  ref,
) {
  const lastEmitted = useRef(value);
  const applyingExternal = useRef(false);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      EntropyMedia,
      EntropyFileRef,
      EntropyNoteMeta,
      Markdown,
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: markdownToTipTapDoc(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "entropy-wysiwyg prose-entropy outline-none min-h-[12rem] w-full max-w-none text-[15px] leading-[1.7]",
        "aria-label": "Note editor",
      },
      handleKeyDown: (_view, event) => {
        if (onKeyDown) {
          // Bridge native keyboard events to the existing MarkdownEditor save shortcut.
          onKeyDown(event as unknown as ReactKeyboardEvent);
        }
        return false;
      },
      handleDrop: (_view, event) => {
        event.preventDefault();
        const entropyPath = event.dataTransfer?.getData("application/x-entropy-path");
        if (entropyPath) {
          onDropPath?.(entropyPath);
          return true;
        }
        const dropped = event.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined;
        if (dropped?.path) {
          onDropPath?.(dropped.path);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      if (applyingExternal.current) return;
      const next = tipTapDocToMarkdown(current.getJSON());
      lastEmitted.current = next;
      onChange(next);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage as {
      entropyNoteMeta?: { notePath: string | null; diskEpoch: number };
    };
    if (storage.entropyNoteMeta) {
      storage.entropyNoteMeta.notePath = notePath ?? null;
      storage.entropyNoteMeta.diskEpoch = diskEpoch;
    }
  }, [diskEpoch, editor, notePath]);

  // External content (disk sync / tab switch) — avoid clobbering identical local emits.
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    applyingExternal.current = true;
    editor.commands.setContent(markdownToTipTapDoc(value));
    lastEmitted.current = value;
    applyingExternal.current = false;
  }, [editor, value, notePath]);

  useImperativeHandle(
    ref,
    () => ({
      insertMarkdown(markdown: string) {
        if (!editor || disabled) return;
        const blocks = parseMarkdownBlocks(markdown);
        for (const block of blocks) {
          if (block.type === "media") {
            editor
              .chain()
              .focus()
              .insertContent({
                type: "entropyMedia",
                attrs: { src: block.src, alt: block.alt, raw: block.raw },
              })
              .run();
            continue;
          }
          if (block.type === "fileRef") {
            editor
              .chain()
              .focus()
              .insertContent({
                type: "entropyFileRef",
                attrs: { src: block.src, label: block.label, raw: block.raw },
              })
              .run();
            continue;
          }
          if (block.value.trim()) {
            editor.chain().focus().insertContent(block.value, { contentType: "markdown" }).run();
          }
        }
      },
      focus(options) {
        if (!editor || disabled) return;
        editor.commands.focus(options?.at === "start" ? "start" : "end");
      },
    }),
    [disabled, editor],
  );

  return (
    <div
      className={cn(
        "select-text entropy-prose-pad mb-8 flex min-h-full w-full flex-1 flex-col pb-16",
        className,
      )}
      onDragOver={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (disabled || !editor) return;
        const target = event.target as HTMLElement;
        if (
          target.closest(
            ".ProseMirror, a, input, iframe, video, img, figure, button.entropy-file-ref",
          )
        ) {
          return;
        }
        event.preventDefault();
        editor.commands.focus("end");
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
      <EditorContent editor={editor} />
    </div>
  );
});
