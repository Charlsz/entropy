import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { Extension } from "@tiptap/core";
import { Bold, Heading2, Italic, List, ListOrdered } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
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

  // External disk / tab content — keep caret when identical.
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
      className={cn("entropy-note-body relative min-h-0 w-full flex-1", className)}
      onDragOver={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (disabled || !editor) return;
        const target = event.target as HTMLElement;
        if (
          target.closest(
            ".ProseMirror, .entropy-bubble-menu, a, input, iframe, video, img, figure, button",
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
      {editor ? (
        <BubbleMenu
          editor={editor}
          className="entropy-bubble-menu flex items-center gap-0.5 rounded-md border px-1 py-0.5 shadow-sm"
          style={{
            backgroundColor: figma.canvas,
            borderColor: figma.border,
          }}
        >
          <FormatButton
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" strokeWidth={1.75} />
          </FormatButton>
          <FormatButton
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" strokeWidth={1.75} />
          </FormatButton>
          <FormatButton
            label="Heading"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="size-3.5" strokeWidth={1.75} />
          </FormatButton>
          <FormatButton
            label="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-3.5" strokeWidth={1.75} />
          </FormatButton>
          <FormatButton
            label="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-3.5" strokeWidth={1.75} />
          </FormatButton>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} className="entropy-wysiwyg-host min-h-[50vh] w-full" />
    </div>
  );
});

function FormatButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground",
        active && "bg-select text-foreground",
      )}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
