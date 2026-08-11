import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { EntropyFileRefView, EntropyMediaView } from "./EntropyEmbedViews";

export const EntropyMedia = Node.create({
  name: "entropyMedia",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      raw: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-entropy-media]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-entropy-media": "",
        "data-src": HTMLAttributes.src,
        "data-alt": HTMLAttributes.alt,
        "data-raw": HTMLAttributes.raw,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntropyMediaView);
  },

  renderMarkdown: (node) => {
    const raw = String(node.attrs?.raw ?? "");
    if (raw) return `${raw}\n\n`;
    const src = String(node.attrs?.src ?? "");
    const alt = String(node.attrs?.alt ?? "");
    return `${alt ? `![[${src}|${alt}]]` : `![[${src}]]`}\n\n`;
  },
});

export const EntropyFileRef = Node.create({
  name: "entropyFileRef",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: "" },
      label: { default: "" },
      raw: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-entropy-file-ref]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-entropy-file-ref": "",
        "data-src": HTMLAttributes.src,
        "data-label": HTMLAttributes.label,
        "data-raw": HTMLAttributes.raw,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntropyFileRefView);
  },

  renderMarkdown: (node) => {
    const raw = String(node.attrs?.raw ?? "");
    if (raw) return `${raw}\n\n`;
    const src = String(node.attrs?.src ?? "");
    const label = String(node.attrs?.label ?? "");
    return `${label ? `[[${src}|${label}]]` : `[[${src}]]`}\n\n`;
  },
});
