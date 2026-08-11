import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { Extension } from "@tiptap/core";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { EntropyFileRef, EntropyMedia } from "../editor/entropyEmbedExtensions";
import {
  markdownToTipTapDoc,
  stripMatchingLeadingTitle,
  tipTapDocToMarkdown,
} from "../editor/markdownDoc";
import { parseMarkdownBlocks } from "../lib/markdownBlocks";
import { figma } from "../lib/figmaTokens";

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
  /** Rendered between the format toolbar and the writing surface. */
  titleSlot?: ReactNode;
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
        editor.commands.focus(options?.at === "start" ? "start" : "end");
      },
    }),
    [disabled, editor],
  );

  return (
    <div
      className={cn("entropy-note-body relative flex min-h-0 w-full flex-1 flex-col", className)}
      onDragOver={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (disabled || !editor) return;
        const target = event.target as HTMLElement;
        if (
          target.closest(
            ".ProseMirror, .entropy-format-toolbar, a, input, iframe, video, img, figure, button, select",
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
      {editor ? <FormatToolbar editor={editor} disabled={Boolean(disabled)} /> : null}
      {titleSlot}
      <EditorContent editor={editor} className="entropy-wysiwyg-host min-h-[50vh] w-full flex-1" />
    </div>
  );
});

function FormatToolbar({
  editor,
  disabled,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  disabled: boolean;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      underline: current.isActive("underline"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      heading: current.isActive("heading")
        ? (current.getAttributes("heading").level as number)
        : 0,
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const headingValue =
    state?.heading === 1
      ? "h1"
      : state?.heading === 2
        ? "h2"
        : state?.heading === 3
          ? "h3"
          : "p";

  return (
    <div
      className="entropy-format-toolbar mb-4 flex flex-wrap items-center gap-0.5 border-b pb-2"
      style={{ borderColor: figma.border }}
      role="toolbar"
      aria-label="Formatting"
    >
      <FormatButton
        label="Undo"
        disabled={disabled || !state?.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Redo"
        disabled={disabled || !state?.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="size-3.5" strokeWidth={1.75} />
      </FormatButton>

      <ToolbarDivider />

      <select
        className="entropy-quiet-control h-7 rounded-md border-0 bg-transparent px-1.5 text-[12px] outline-none"
        style={{ color: figma.muted }}
        aria-label="Heading level"
        disabled={disabled}
        value={headingValue}
        onChange={(event) => {
          const next = event.target.value;
          const chain = editor.chain().focus();
          if (next === "p") chain.setParagraph().run();
          else if (next === "h1") chain.toggleHeading({ level: 1 }).run();
          else if (next === "h2") chain.toggleHeading({ level: 2 }).run();
          else if (next === "h3") chain.toggleHeading({ level: 3 }).run();
        }}
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      <ToolbarDivider />

      <FormatButton
        label="Bullet list"
        active={Boolean(state?.bulletList)}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Numbered list"
        active={Boolean(state?.orderedList)}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" strokeWidth={1.75} />
      </FormatButton>

      <ToolbarDivider />

      <FormatButton
        label="Bold"
        active={Boolean(state?.bold)}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Italic"
        active={Boolean(state?.italic)}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Strikethrough"
        active={Boolean(state?.strike)}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Underline"
        active={Boolean(state?.underline)}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
    </div>
  );
}

function ToolbarDivider() {
  return (
    <span
      className="mx-1 h-4 w-px shrink-0"
      style={{ backgroundColor: figma.border }}
      aria-hidden
    />
  );
}

function FormatButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "entropy-quiet-control inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
        active ? "text-foreground" : "text-muted-foreground",
        disabled && "opacity-40",
      )}
      style={active ? { backgroundColor: figma.surface } : undefined}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
