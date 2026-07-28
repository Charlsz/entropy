import { useState } from "react";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { TreeNode } from "../../shared/types";
import { cn } from "../lib/utils";

interface FolderTreeProps {
  nodes: TreeNode[];
  activePath: string;
  onSelect: (path: string) => void;
  depth?: number;
}

export function FolderTree({ nodes, activePath, onSelect, depth = 0 }: FolderTreeProps) {
  return (
    <ul className="space-y-0.5" style={{ paddingLeft: depth === 0 ? 0 : 8 }}>
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
  const active = activePath === node.path;

  return (
    <li>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
          aria-label={open ? "Collapse" : "Expand"}
          disabled={!hasChildren}
          onClick={() => setOpen((value) => !value)}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          )}
        </button>
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
            active && "bg-accent text-foreground",
          )}
          onClick={() => onSelect(node.path)}
        >
          <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">{node.name}</span>
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
