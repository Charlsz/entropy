import { HardDrive } from "lucide-react";
import { cn } from "../lib/utils";

export interface TreemapNode {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  children?: TreemapNode[];
}

interface StorageTreemapProps {
  rootLabel?: string;
  nodes?: TreemapNode[];
  selectedPath?: string | null;
  scanning?: boolean;
  onSelect?: (path: string) => void;
  className?: string;
}

/** Placeholder storage view; Phase 4 replaces this with a real squarified treemap. */
export function StorageTreemap({
  rootLabel = "Storage",
  nodes = [],
  selectedPath = null,
  scanning = false,
  onSelect,
  className,
}: StorageTreemapProps) {
  const total = nodes.reduce((sum, node) => sum + Math.max(node.size, 0), 0);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)} aria-label="Storage treemap">
      <div className="flex items-center gap-2 px-4 py-3">
        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Storage
        </h2>
        <span className="ml-auto truncate text-[11px] text-muted-foreground">{rootLabel}</span>
      </div>

      <div className="min-h-0 flex-1 px-3 pb-3">
        {scanning ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Measuring folder sizes…
          </div>
        ) : nodes.length === 0 || total <= 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 text-center">
            <p className="text-sm text-muted-foreground">
              Size map appears here once this folder is measured.
            </p>
          </div>
        ) : (
          <div className="grid h-full min-h-[160px] grid-cols-2 grid-rows-2 gap-1.5">
            {nodes.slice(0, 4).map((node) => {
              const share = Math.max(node.size / total, 0.02);
              const selected = selectedPath === node.path;
              return (
                <button
                  key={node.path}
                  type="button"
                  title={`${node.name} · ${formatBytes(node.size)}`}
                  className={cn(
                    "flex min-h-0 flex-col justify-between overflow-hidden rounded-lg border border-border/60 bg-background/40 p-2.5 text-left transition-colors hover:bg-accent/60",
                    selected && "ring-1 ring-ring",
                  )}
                  style={{ flexGrow: share }}
                  onClick={() => onSelect?.(node.path)}
                >
                  <span className="truncate text-xs font-medium text-foreground">{node.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatBytes(node.size)} · {Math.round((node.size / total) * 100)}%
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
