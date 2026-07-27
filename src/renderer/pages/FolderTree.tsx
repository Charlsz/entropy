import { useState } from "react";
import type { TreeNode } from "../../shared/types";

interface FolderTreeProps {
  nodes: TreeNode[];
  activePath: string;
  onSelect: (path: string) => void;
  depth?: number;
}

export function FolderTree({ nodes, activePath, onSelect, depth = 0 }: FolderTreeProps) {
  return (
    <ul className="folder-tree" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      {nodes.map((node) => (
        <FolderTreeItem
          key={node.path}
          node={node}
          activePath={activePath}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </ul>
  );
}

function FolderTreeItem({
  node,
  activePath,
  onSelect,
  depth,
}: {
  node: TreeNode;
  activePath: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <li>
      <div className="tree-row">
        <button
          type="button"
          className="tree-toggle"
          aria-label={open ? "Collapse" : "Expand"}
          disabled={!hasChildren}
          onClick={() => setOpen((value) => !value)}
        >
          {hasChildren ? (open ? "▾" : "▸") : "·"}
        </button>
        <button
          type="button"
          className={`tree-label${activePath === node.path ? " is-active" : ""}`}
          onClick={() => onSelect(node.path)}
        >
          {node.name}
        </button>
      </div>
      {open && hasChildren ? (
        <FolderTree
          nodes={node.children ?? []}
          activePath={activePath}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ) : null}
    </li>
  );
}
