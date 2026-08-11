import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import type { ReactNode } from "react";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
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

const IDLE_TOOLBAR_STATE = {
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

function liveEditor(editor: Editor | null): Editor | null {
  return editor && !editor.isDestroyed ? editor : null;
}

export function NoteFormatToolbar({
  editor,
  disabled = false,
  className,
}: {
  editor: Editor | null;
  disabled?: boolean;
  className?: string;
}) {
  const active = liveEditor(editor);
  const state = useEditorState({
    editor: active,
    selector: (ctx) => {
      const current = liveEditor(ctx.editor);
      if (!current) return IDLE_TOOLBAR_STATE;
      try {
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
      } catch {
        return IDLE_TOOLBAR_STATE;
      }
    },
  });

  if (!active) {
    return (
      <div
        className={cn("entropy-format-toolbar flex min-w-0 flex-1 items-center", className)}
        aria-hidden
      />
    );
  }

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
        onClick={() => active.chain().focus().undo().run()}
      >
        <Undo2 className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Redo"
        disabled={disabled || !state?.canRedo}
        onClick={() => active.chain().focus().redo().run()}
      >
        <Redo2 className="size-3.5" strokeWidth={1.75} />
      </FormatButton>

      <ToolbarDivider />

      <FormatButton
        label="Heading 1"
        active={state?.heading === 1}
        disabled={disabled}
        onClick={() => active.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Heading 2"
        active={state?.heading === 2}
        disabled={disabled}
        onClick={() => active.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Heading 3"
        active={state?.heading === 3}
        disabled={disabled}
        onClick={() => active.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-3.5" strokeWidth={1.75} />
      </FormatButton>

      <ToolbarDivider />

      <FormatButton
        label="Bullet list"
        active={Boolean(state?.bulletList)}
        disabled={disabled}
        onClick={() => active.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Numbered list"
        active={Boolean(state?.orderedList)}
        disabled={disabled}
        onClick={() => active.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" strokeWidth={1.75} />
      </FormatButton>

      <ToolbarDivider />

      <FormatButton
        label="Bold"
        active={Boolean(state?.bold)}
        disabled={disabled}
        onClick={() => active.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Italic"
        active={Boolean(state?.italic)}
        disabled={disabled}
        onClick={() => active.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Strikethrough"
        active={Boolean(state?.strike)}
        disabled={disabled}
        onClick={() => active.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-3.5" strokeWidth={1.75} />
      </FormatButton>
      <FormatButton
        label="Underline"
        active={Boolean(state?.underline)}
        disabled={disabled}
        onClick={() => active.chain().focus().toggleUnderline().run()}
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
