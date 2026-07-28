import { useState } from "react";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { TreeNode } from "../../shared/types";
import { cn } from "../lib/utils";
import {
  Collapsible,
  CollapsibleContent,
} from "../components/ui/collapsible";

interface FolderTreeProps {
  nodes: TreeNode[];
  activePath: string;
  onSelect: (path: string) => void;
  depth?: number;
}

export function FolderTree({ nodes, activePath, onSelect, depth = 0 }: FolderTreeProps) {
  return (
    <ul className="space-y-1" style={{ paddingLeft: depth === 0 ? 0 : 8 }}>
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

  function toggle(): void {
    if (!hasChildren) {
      onSelect(node.path);
      return;
    }
    if (open && active) {
      setOpen(false);
      return;
    }
    setOpen(true);
    onSelect(node.path);
  }

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen} disabled={!hasChildren}>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
            active && "bg-accent text-foreground",
          )}
          onClick={toggle}
          title={hasChildren ? (open ? "Collapse folder" : "Expand folder") : node.name}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
            {hasChildren ? (
              open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <span className="h-1 w-1 rounded-full bg-paper-2/40" />
            )}
          </span>
          <Folder className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{node.name}</span>
        </button>
        {hasChildren ? (
          <CollapsibleContent>
            <FolderTree
              nodes={node.children ?? []}
              activePath={activePath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          </CollapsibleContent>
        ) : null}
      </Collapsible>
    </li>
  );
}
