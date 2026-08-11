import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import type { ReactNode } from "react";
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
import { figma } from "../lib/figmaTokens";

export function NoteFormatToolbar({
  editor,
  disabled = false,
  className,
}: {
  editor: Editor | null;
  disabled?: boolean;
  className?: string;
}) {
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const current = ctx.editor;
      if (!current) {
        return {
          bold: false,
          italic: false,
          strike: false,
          underline: false,
          bulletList: false,
          orderedList: false,
          heading: 0,
          canUndo: false,
          canRedo: false,
        };
      }
      return {
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
      };
    },
  });

  if (!editor) {
    return (
      <div
        className={cn("entropy-format-toolbar flex min-w-0 flex-1 items-center", className)}
        aria-hidden
      />
    );
  }

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
      className={cn(
        "entropy-format-toolbar flex min-w-0 flex-1 flex-wrap items-center gap-0.5 px-2",
        className,
      )}
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
