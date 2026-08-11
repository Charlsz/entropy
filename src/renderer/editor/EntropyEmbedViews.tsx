import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { FileRefChip, MediaFace } from "../components/LiveMarkdownEditor";
import { useWorkspace } from "../state/useWorkspace";

export function EntropyMediaView({ node, deleteNode, editor, selected }: NodeViewProps) {
  const { workspace } = useWorkspace();
  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  const meta = (editor.storage as {
    entropyNoteMeta?: { notePath?: string | null; diskEpoch?: number };
  }).entropyNoteMeta;
  const notePath = meta?.notePath;
  const diskEpoch = meta?.diskEpoch ?? 0;

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
        disabled={!editor.isEditable}
        onOpenSource={() => {
          // Faces stay visual in WYSIWYG; Backspace/Delete removes.
        }}
        onRemove={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}

export function EntropyFileRefView({ node, deleteNode, editor, selected }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  const label = String(node.attrs.label ?? "");

  return (
    <NodeViewWrapper
      className={selected ? "rounded-full ring-2 ring-ring inline-flex" : "inline-flex"}
      data-drag-handle
    >
      <FileRefChip
        label={label}
        src={src}
        disabled={!editor.isEditable}
        onOpenSource={() => undefined}
        onRemove={() => deleteNode()}
      />
    </NodeViewWrapper>
  );
}
