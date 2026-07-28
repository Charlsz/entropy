import { useEffect, useState } from "react";
import type { TreeNode } from "../../shared/types";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "../lib/utils";

interface MoveToDialogProps {
  open: boolean;
  rootPath: string;
  rootName: string;
  excludePath: string;
  onClose: () => void;
  onMove: (destinationFolder: string) => void;
}

export function MoveToDialog({
  open,
  rootPath,
  rootName,
  excludePath,
  onClose,
  onMove,
}: MoveToDialogProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selected, setSelected] = useState(rootPath);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(rootPath);
    setLoading(true);
    let cancelled = false;
    void window.entropy.fs
      .folderTree(rootPath, 5)
      .then((nodes) => {
        if (!cancelled) setTree(nodes);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, rootPath]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Move to folder">
      <button type="button" className="absolute inset-0 bg-ink/60" aria-label="Cancel" onClick={onClose} />
      <div className="relative z-10 flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-ink-2">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-paper">Move to…</h2>
          <p className="mt-1 text-xs text-muted-foreground">Choose a destination folder in this workspace.</p>
        </div>
        <ScrollArea className="min-h-0 flex-1 px-2 py-2">
          {loading ? <p className="px-2 py-3 text-xs text-muted-foreground">Loading folders…</p> : null}
          <FolderPickRow
            path={rootPath}
            name={rootName}
            selected={selected}
            excludePath={excludePath}
            onSelect={setSelected}
            depth={0}
          />
          <FolderPickTree
            nodes={tree}
            selected={selected}
            excludePath={excludePath}
            onSelect={setSelected}
            depth={1}
          />
        </ScrollArea>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selected === excludePath || selected.startsWith(`${excludePath}\\`) || selected.startsWith(`${excludePath}/`)}
            onClick={() => onMove(selected)}
          >
            Move
          </Button>
        </div>
      </div>
    </div>
  );
}

function FolderPickTree({
  nodes,
  selected,
  excludePath,
  onSelect,
  depth,
}: {
  nodes: TreeNode[];
  selected: string;
  excludePath: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (node.path === excludePath) return null;
        return (
          <div key={node.path}>
            <FolderPickRow
              path={node.path}
              name={node.name}
              selected={selected}
              excludePath={excludePath}
              onSelect={onSelect}
              depth={depth}
            />
            {node.children?.length ? (
              <FolderPickTree
                nodes={node.children}
                selected={selected}
                excludePath={excludePath}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function FolderPickRow({
  path,
  name,
  selected,
  excludePath,
  onSelect,
  depth,
}: {
  path: string;
  name: string;
  selected: string;
  excludePath: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const disabled =
    path === excludePath ||
    path.startsWith(`${excludePath}\\`) ||
    path.startsWith(`${excludePath}/`);

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full truncate rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
        selected === path && "bg-accent text-foreground",
      )}
      style={{ paddingLeft: 8 + depth * 12 }}
      onClick={() => onSelect(path)}
    >
      <span className="truncate">{name}</span>
    </button>
  );
}
