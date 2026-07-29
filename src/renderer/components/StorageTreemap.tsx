import { useMemo, useState, useEffect, type KeyboardEvent } from "react";
import { HardDrive } from "lucide-react";
import type { TreemapFileLeaf, TreemapScanResult } from "../../shared/types";
import {
  FILE_KIND_FILL,
  FILE_KIND_LABEL,
  FILE_KIND_ORDER,
  type FileKindId,
} from "../../shared/fileKinds";
import { cn } from "../lib/utils";
import { squarify } from "../lib/squarify";

interface StorageTreemapProps {
  rootLabel?: string;
  scan?: TreemapScanResult | null;
  selectedPath?: string | null;
  scanning?: boolean;
  onSelect?: (leaf: TreemapFileLeaf) => void;
  onOpen?: (leaf: TreemapFileLeaf) => void;
  className?: string;
}

function isAggregateLeaf(leaf: TreemapFileLeaf): boolean {
  return leaf.path.endsWith(".__entropy_other__") || leaf.name.startsWith("Other (");
}

export function StorageTreemap({
  rootLabel = "Storage",
  scan = null,
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

  const files = scan?.files ?? [];
  const total = scan?.totalSize ?? 0;
  const showMap = files.length > 0 && total > 0;

  const kindTotals = useMemo(() => {
    const map = new Map<FileKindId, { size: number; count: number }>();
    for (const file of files) {
      if (isAggregateLeaf(file)) continue;
      const prev = map.get(file.kind) ?? { size: 0, count: 0 };
      prev.size += file.size;
      prev.count += 1;
      map.set(file.kind, prev);
    }
    return FILE_KIND_ORDER.filter((kind) => map.has(kind)).map((kind) => ({
      kind,
      size: map.get(kind)!.size,
      count: map.get(kind)!.count,
      fill: FILE_KIND_FILL[kind],
      label: FILE_KIND_LABEL[kind],
    }));
  }, [files]);

  const layout = useMemo(() => {
    if (!showMap || size.width < 8 || size.height < 8) return [];
    const gap = 1;
    const rects = squarify(
      files.map((file) => ({ id: file.path, size: file.size })),
      0,
      0,
      size.width,
      size.height,
    );
    const byPath = new Map(files.map((file) => [file.path, file]));
    return rects
      .map((rect) => {
        const file = byPath.get(rect.id);
        if (!file) return null;
        const width = Math.max(rect.width - gap, 0);
        const height = Math.max(rect.height - gap, 0);
        if (width <= 1.5 || height <= 1.5) return null;
        return {
          ...file,
          x: rect.x + gap / 2,
          y: rect.y + gap / 2,
          width,
          height,
          fill: FILE_KIND_FILL[file.kind],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [files, showMap, size.height, size.width]);

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
          {scan?.fileCount ? ` · ${scan.fileCount.toLocaleString()} files` : ""}
        </span>
      </div>

      <div className="min-h-0 flex-1 px-3 pb-2">
        {scanning && !showMap ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Indexing files by type…
          </div>
        ) : !showMap ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 text-center">
            <p className="text-sm text-muted-foreground">
              File size map by type appears here once this folder is scanned.
            </p>
          </div>
        ) : (
          <div
            ref={setFrameEl}
            className="relative h-full min-h-[160px] overflow-hidden rounded-xl bg-ink"
            role="list"
            aria-label="File size map by type"
          >
            {layout.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {scanning ? "Indexing files by type…" : "Preparing size map…"}
              </div>
            ) : (
              layout.map((cell) => {
                const selected = selectedPath === cell.path;
                const showLabel = cell.width > 64 && cell.height > 36 && !isAggregateLeaf(cell);
                const kindLabel = FILE_KIND_LABEL[cell.kind];
                return (
                  <button
                    key={cell.path}
                    type="button"
                    role="listitem"
                    title={`${cell.name} · ${kindLabel} · ${formatBytes(cell.size)}`}
                    className={cn(
                      "absolute overflow-hidden border border-black/30 p-1 text-left transition-[filter,box-shadow] hover:brightness-110 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      selected && "z-10 ring-1 ring-ring brightness-110",
                      isAggregateLeaf(cell) && "cursor-default opacity-80",
                    )}
                    style={{
                      left: cell.x,
                      top: cell.y,
                      width: cell.width,
                      height: cell.height,
                      backgroundColor: cell.fill,
                    }}
                    onClick={() => {
                      if (isAggregateLeaf(cell)) return;
                      onSelect?.(cell);
                    }}
                    onDoubleClick={() => {
                      if (isAggregateLeaf(cell)) return;
                      onOpen?.(cell);
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                      if (event.key === "Enter" && !isAggregateLeaf(cell)) onOpen?.(cell);
                    }}
                  >
                    {showLabel ? (
                      <span className="flex h-full min-h-0 flex-col justify-between">
                        <span className="truncate text-[10px] font-medium text-foreground">
                          {cell.name}
                        </span>
                        <span className="truncate text-[9px] text-muted-foreground">
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
                Updating file index…
              </div>
            ) : null}
          </div>
        )}
      </div>

      {kindTotals.length > 0 ? (
        <div className="shrink-0 border-t border-border px-3 py-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            By type
          </p>
          <div className="flex flex-wrap gap-1.5">
            {kindTotals.map((item) => (
              <div
                key={item.kind}
                className="flex items-center gap-1.5 rounded-md bg-background/40 px-1.5 py-1 text-[10px] text-muted-foreground"
                title={`${item.count.toLocaleString()} files · ${formatBytes(item.size)}`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/30"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="text-foreground/90">{item.label}</span>
                <span>{formatBytes(item.size)}</span>
              </div>
            ))}
          </div>
          {scan?.truncated ? (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Showing largest files; smaller ones are grouped as Other.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
