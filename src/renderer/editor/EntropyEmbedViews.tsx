import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { FileRefChip, MediaFace } from "../components/LiveMarkdownEditor";
import { useWorkspace } from "../state/useWorkspace";
import { parseMarkdownBlocks } from "../lib/markdownBlocks";
import { markdownToTipTapDoc } from "./markdownDoc";

function fallbackMediaRaw(src: string, alt: string): string {
  return alt && alt !== src.split(/[/\\]/).pop() ? `![[${src}|${alt}]]` : `![[${src}]]`;
}

function fallbackFileRaw(src: string, label: string): string {
  return label && label !== src.split(/[/\\]/).pop() ? `[[${src}|${label}]]` : `[[${src}]]`;
}

function applyEmbedDraft(
  editor: Editor,
  getPos: () => number | undefined,
  nodeSize: number,
  draft: string,
  deleteNode: () => void,
): void {
  if (editor.isDestroyed) return;
  const trimmed = draft.trim();
  if (!trimmed) {
    deleteNode();
    return;
  }

  const pos = getPos();
  if (typeof pos !== "number") return;

  const doc = markdownToTipTapDoc(trimmed);
  const content = doc.content ?? [{ type: "paragraph" }];
  editor
    .chain()
    .focus()
    .insertContentAt({ from: pos, to: pos + nodeSize }, content)
    .run();
}

function SourceLineEditor({
  initialValue,
  ariaLabel,
  onCommit,
}: {
  initialValue: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);
  const committed = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  function commit(): void {
    if (committed.current) return;
    committed.current = true;
    onCommit(draft);
  }

  return (
    <textarea
      ref={ref}
      className="min-h-[1.75rem] w-full resize-none overflow-hidden rounded-none border-0 bg-transparent p-0 font-sans text-[15px] font-normal leading-[1.7] text-foreground shadow-none outline-none focus-visible:ring-0"
      value={draft}
      spellCheck={false}
      aria-label={ariaLabel}
      onChange={(event) => {
        setDraft(event.target.value);
        event.target.style.height = "auto";
        event.target.style.height = `${event.target.scrollHeight}px`;
      }}
      onBlur={() => commit()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          committed.current = true;
          onCommit(initialValue);
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

export function EntropyMediaView({
  node,
  deleteNode,
  editor,
  selected,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const { workspace } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  const raw = String(node.attrs.raw ?? "") || fallbackMediaRaw(src, alt);
  const meta = editor.isDestroyed
    ? undefined
    : (editor.storage as { entropyNoteMeta?: { notePath?: string | null; diskEpoch?: number } })
        .entropyNoteMeta;
  const notePath = meta?.notePath;
  const diskEpoch = meta?.diskEpoch ?? 0;
  const disabled = editor.isDestroyed || !editor.isEditable;

  if (editing && !disabled) {
    return (
      <NodeViewWrapper className="entropy-embed-source">
        <SourceLineEditor
          initialValue={raw}
          ariaLabel="Markdown media source"
          onCommit={(value) => {
            const trimmed = value.trim();
            if (!trimmed) {
              deleteNode();
              return;
            }
            const blocks = parseMarkdownBlocks(`${trimmed}\n`);
            const only = blocks.length === 1 ? blocks[0]! : null;
            if (only?.type === "media") {
              updateAttributes({
                src: only.src,
                alt: only.alt,
                raw: only.raw,
              });
              setEditing(false);
              return;
            }
            applyEmbedDraft(editor, getPos, node.nodeSize, trimmed, deleteNode);
            setEditing(false);
          }}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={selected ? "rounded-lg ring-2 ring-ring" : undefined}
      data-drag-handle
    >
      <MediaFace
        alt={alt}
        src={src}
        notePath={notePath}
        workspacePath={workspace.path}
        diskEpoch={diskEpoch}
        disabled={disabled}
        onOpenSource={() => {
          if (!disabled) setEditing(true);
        }}
        onRemove={() => {
          if (!disabled) deleteNode();
        }}
      />
    </NodeViewWrapper>
  );
}

export function EntropyFileRefView({
  node,
  deleteNode,
  editor,
  selected,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const src = String(node.attrs.src ?? "");
  const label = String(node.attrs.label ?? "");
  const raw = String(node.attrs.raw ?? "") || fallbackFileRaw(src, label);
  const disabled = editor.isDestroyed || !editor.isEditable;

  if (editing && !disabled) {
    return (
      <NodeViewWrapper className="entropy-embed-source inline-flex w-full">
        <SourceLineEditor
          initialValue={raw}
          ariaLabel="File reference source"
          onCommit={(value) => {
            const trimmed = value.trim();
            if (!trimmed) {
              deleteNode();
              return;
            }
            const blocks = parseMarkdownBlocks(`${trimmed}\n`);
            const only = blocks.length === 1 ? blocks[0]! : null;
            if (only?.type === "fileRef") {
              updateAttributes({
                src: only.src,
                label: only.label,
                raw: only.raw,
              });
              setEditing(false);
              return;
            }
            applyEmbedDraft(editor, getPos, node.nodeSize, trimmed, deleteNode);
            setEditing(false);
          }}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={selected ? "rounded-full ring-2 ring-ring inline-flex" : "inline-flex"}
      data-drag-handle
    >
      <FileRefChip
        label={label}
        src={src}
        disabled={disabled}
        onOpenSource={() => {
          if (!disabled) setEditing(true);
        }}
        onRemove={() => {
          if (!disabled) deleteNode();
        }}
      />
    </NodeViewWrapper>
  );
}
