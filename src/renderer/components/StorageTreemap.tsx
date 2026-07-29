import { useMemo, useState, useEffect, type KeyboardEvent } from "react";
import { HardDrive } from "lucide-react";
import { cn } from "../lib/utils";
import { squarify } from "../lib/squarify";

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
  onOpen?: (path: string) => void;
  className?: string;
}

/** Low-chroma fills that sit next to ink/paper without neon WinDirStat brightness. */
const TREEMAP_FILLS = [
  "#3a3f46", // cool slate
  "#403c38", // warm stone
  "#3a403c", // muted sage
  "#3f3a42", // dusty mauve
  "#383e40", // teal stone
  "#403e36", // olive ash
  "#373b44", // blue slate
  "#423a38", // clay
] as const;

function hashPath(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function fillForNode(path: string, share: number): string {
  const base = TREEMAP_FILLS[hashPath(path) % TREEMAP_FILLS.length];
  // Larger shares lift slightly toward paper-2 so distribution is visible, still quiet.
  const lift = Math.min(0.22, 0.06 + share * 0.28);
  return `color-mix(in srgb, ${base} ${Math.round((1 - lift) * 100)}%, #f4f4ff)`;
}

export function StorageTreemap({
  rootLabel = "Storage",
  nodes = [],
  selectedPath = null,
  scanning = false,
  onSelect,
  onOpen,
  className,
}: StorageTreemapProps) {
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!frameEl) return;
    const sync = () => {
      const rect = frameEl.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(frameEl);
    return () => observer.disconnect();
  }, [frameEl]);

  const total = useMemo(
    () => nodes.reduce((sum, node) => sum + Math.max(node.size, 0), 0),
    [nodes],
  );

  const showMap = nodes.length > 0 && total > 0;

  const layout = useMemo(() => {
    if (!showMap || size.width < 8 || size.height < 8) return [];
    const gap = 1.5;
    const rects = squarify(
      nodes.map((node) => ({ id: node.path, size: node.size })),
      0,
      0,
      size.width,
      size.height,
    );
    const byPath = new Map(nodes.map((node) => [node.path, node]));
    return rects
      .map((rect) => {
        const node = byPath.get(rect.id);
        if (!node) return null;
        const width = Math.max(rect.width - gap, 0);
        const height = Math.max(rect.height - gap, 0);
        if (width <= 2 || height <= 2) return null;
        const share = total > 0 ? node.size / total : 0;
        return {
          ...node,
          x: rect.x + gap / 2,
          y: rect.y + gap / 2,
          width,
          height,
          fill: fillForNode(node.path, share),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [nodes, showMap, size.height, size.width, total]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)} aria-label="Storage treemap">
      <div className="flex items-center gap-2 px-4 py-3">
        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Storage
        </h2>
        <span className="ml-auto truncate text-[11px] text-muted-foreground">
          {rootLabel}
          {total > 0 ? ` · ${formatBytes(total)}` : ""}
        </span>
      </div>

      <div className="min-h-0 flex-1 px-3 pb-3">
        {scanning && !showMap ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Measuring folder sizes…
          </div>
        ) : !showMap ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 text-center">
            <p className="text-sm text-muted-foreground">
              Size map appears here once this folder is measured.
            </p>
          </div>
        ) : (
          <div
            ref={setFrameEl}
            className="relative h-full min-h-[160px] overflow-hidden rounded-xl bg-ink"
            role="list"
            aria-label="Folder size map"
          >
            {layout.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {scanning ? "Measuring folder sizes…" : "Preparing size map…"}
              </div>
            ) : (
              layout.map((cell) => {
                const selected = selectedPath === cell.path;
                const showLabel = cell.width > 56 && cell.height > 34;
                return (
                  <button
                    key={cell.path}
                    type="button"
                    role="listitem"
                    title={`${cell.name} · ${formatBytes(cell.size)}`}
                    className={cn(
                      "absolute overflow-hidden border border-black/25 p-1.5 text-left transition-[filter,box-shadow] hover:brightness-110 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      selected && "z-10 ring-1 ring-ring brightness-110",
                    )}
                    style={{
                      left: cell.x,
                      top: cell.y,
                      width: cell.width,
                      height: cell.height,
                      backgroundColor: cell.fill,
                    }}
                    onClick={() => onSelect?.(cell.path)}
                    onDoubleClick={() => onOpen?.(cell.path)}
                    onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                      if (event.key === "Enter") onOpen?.(cell.path);
                    }}
                  >
                    {showLabel ? (
                      <span className="flex h-full min-h-0 flex-col justify-between">
                        <span className="truncate text-[11px] font-medium text-foreground">
                          {cell.name}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {formatBytes(cell.size)}
                        </span>
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
            {scanning ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1 text-center text-[10px] text-muted-foreground">
                Updating sizes…
              </div>
            ) : null}
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
