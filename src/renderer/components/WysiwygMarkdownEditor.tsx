import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { Extension } from "@tiptap/core";
import { cn } from "../lib/utils";
import { EntropyFileRef, EntropyMedia } from "../editor/entropyEmbedExtensions";
import {
  markdownToTipTapDoc,
  stripMatchingLeadingTitle,
  tipTapDocToMarkdown,
} from "../editor/markdownDoc";
import { parseMarkdownBlocks } from "../lib/markdownBlocks";

export interface WysiwygMarkdownEditorHandle {
  insertMarkdown: (markdown: string) => void;
  focus: (options?: { at?: "start" | "end" }) => void;
}

interface WysiwygMarkdownEditorProps {
  value: string;
  /** Filename title (without .md) — used to hide a legacy leading `# Title`. */
  noteTitle?: string;
  notePath?: string | null;
  diskEpoch?: number;
  disabled?: boolean;
  className?: string;
  /** Rendered above the writing surface (e.g. editable title). */
  titleSlot?: ReactNode;
  onChange: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  onDropPath?: (absolutePath: string) => void;
  /** Expose the TipTap editor to the Notebook chrome toolbar. */
  onEditorReady?: (editor: Editor | null) => void;
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
  {
    value,
    noteTitle = "",
    notePath,
    diskEpoch = 0,
    disabled,
    className,
    titleSlot,
    onChange,
    onKeyDown,
    onDropPath,
    onEditorReady,
  },
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
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
        emptyEditorClass: "is-editor-empty",
      }),
      EntropyMedia,
      EntropyFileRef,
      EntropyNoteMeta,
      Markdown,
    ],
    [],
  );

  const initialDoc = useMemo(() => {
    const body = stripMatchingLeadingTitle(value, noteTitle);
    return markdownToTipTapDoc(body);
  }, [notePath]); // eslint-disable-line react-hooks/exhaustive-deps -- seed once per note

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      extensions,
      content: initialDoc,
      editable: !disabled,
      editorProps: {
        attributes: {
          class: "entropy-wysiwyg",
          "aria-label": "Note editor",
          spellcheck: "true",
        },
        handleKeyDown: (_view, event) => {
          if (onKeyDown) {
            onKeyDown(event as unknown as ReactKeyboardEvent);
          }
          return false;
        },
        handleDrop: (_view, event) => {
          const entropyPath = event.dataTransfer?.getData("application/x-entropy-path");
          if (entropyPath) {
            event.preventDefault();
            onDropPath?.(entropyPath);
            return true;
          }
          const dropped = event.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined;
          if (dropped?.path) {
            event.preventDefault();
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
    },
    [notePath],
  );

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

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

  useEffect(() => {
    if (!editor) return;
    const body = stripMatchingLeadingTitle(value, noteTitle);
    if (body === lastEmitted.current) return;
    const current = tipTapDocToMarkdown(editor.getJSON());
    if (body === current) {
      lastEmitted.current = body;
      return;
    }
    applyingExternal.current = true;
    editor.commands.setContent(markdownToTipTapDoc(body));
    lastEmitted.current = body;
    applyingExternal.current = false;
  }, [editor, value, noteTitle, notePath]);

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
        // Prefer caret-preserving focus; only jump when asked.
        if (options?.at === "start") editor.commands.focus("start");
        else if (options?.at === "end") editor.commands.focus("end");
        else editor.commands.focus();
      },
    }),
    [disabled, editor],
  );

  return (
    <div
      className={cn("entropy-note-body relative flex min-h-0 w-full flex-1 flex-col", className)}
      onDragOver={(event) => event.preventDefault()}
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
      {titleSlot}
      <EditorContent editor={editor} className="entropy-wysiwyg-host min-h-[50vh] w-full flex-1" />
    </div>
  );
});
