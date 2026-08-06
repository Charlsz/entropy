import { useMemo, useState, useEffect, type KeyboardEvent, type PointerEvent } from "react";
import type { TreemapFileLeaf, TreemapScanResult } from "../../shared/types";
import {
  FILE_KIND_FILL,
  FILE_KIND_FILL_LIGHT,
  FILE_KIND_LABEL,
  FOLDER_FILL_DARK,
  FOLDER_FILL_LIGHT,
} from "../../shared/fileKinds";
import { cn } from "../lib/utils";
import { samePath } from "../lib/platform";
import { squarify } from "../lib/squarify";
import { useWorkspace } from "../state/useWorkspace";
import { formatBytes } from "../lib/format";

/** Smallest rendered tile — readable as a block while still scaling with the panel. */
const MIN_TILE_EDGE = 16;

/** Fold leaves too small for the current panel into Other so every tile meets MIN_TILE_EDGE. */
function layoutLeaves(
  files: TreemapFileLeaf[],
  total: number,
  frameWidth: number,
  frameHeight: number,
): TreemapFileLeaf[] {
  const frameArea = Math.max(frameWidth * frameHeight, 1);
  const minAreaShare = (MIN_TILE_EDGE * MIN_TILE_EDGE) / frameArea;
  const floorSize = Math.max(1, Math.floor(total * minAreaShare));

  const kept: TreemapFileLeaf[] = [];
  let otherSize = 0;
  let otherCount = 0;
  let existingOther: TreemapFileLeaf | null = null;

  for (const file of files) {
    if (isAggregateLeaf(file)) {
      existingOther = file;
      otherSize += file.size;
      const match = /\((\d+)/.exec(file.name);
      otherCount += match ? Number(match[1]) : 1;
      continue;
    }
    if (file.size >= floorSize) {
      kept.push(file);
      continue;
    }
    otherSize += file.size;
    otherCount += 1;
  }

  if (otherCount > 0 && otherSize > 0) {
    const rootHint = existingOther?.path ?? kept[0]?.path ?? files[0]?.path ?? "other";
    const slash = rootHint.includes("\\") && !rootHint.includes("/") ? "\\" : "/";
    const parent = rootHint.replace(/[/\\][^/\\]+$/, "") || rootHint;
    kept.push({
      path: existingOther?.path ?? `${parent}${slash}.__entropy_other__`,
      name: `Other (${otherCount.toLocaleString()})`,
      size: otherSize,
      extension: "",
      kind: "other",
      isDirectory: false,
      location: existingOther?.location,
      modifiedAt: existingOther?.modifiedAt,
    });
  }

  return kept;
}

interface StorageTreemapProps {
  scan?: TreemapScanResult | null;
  selectedPath?: string | null;
  scanning?: boolean;
  onSelect?: (leaf: TreemapFileLeaf) => void;
  onOpen?: (leaf: TreemapFileLeaf) => void;
  onZoom?: (leaf: TreemapFileLeaf) => void;
  className?: string;
}

interface HoverState {
  leaf: TreemapFileLeaf;
  x: number;
  y: number;
}

function isAggregateLeaf(leaf: TreemapFileLeaf): boolean {
  return leaf.path.endsWith(".__entropy_other__") || leaf.name.startsWith("Other (");
}

function kindLabelFor(leaf: TreemapFileLeaf): string {
  if (leaf.isDirectory) return "Folder";
  const label = FILE_KIND_LABEL[leaf.kind];
  if (label.endsWith("s") && label !== "Other") return label.slice(0, -1);
  return label;
}

function fillFor(leaf: TreemapFileLeaf, light: boolean): string {
  if (leaf.isDirectory) return light ? FOLDER_FILL_LIGHT : FOLDER_FILL_DARK;
  return (light ? FILE_KIND_FILL_LIGHT : FILE_KIND_FILL)[leaf.kind];
}

export function StorageTreemap({
  scan = null,
  selectedPath = null,
  scanning = false,
  onSelect,
  onOpen,
  onZoom,
  className,
}: StorageTreemapProps) {
  const { workspace } = useWorkspace();
  const light = workspace.settings.theme === "light";
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<HoverState | null>(null);

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

  const layout = useMemo(() => {
    if (!showMap || size.width < MIN_TILE_EDGE || size.height < MIN_TILE_EDGE) return [];
    const gap = 1;
    const leaves = layoutLeaves(files, total, size.width, size.height);
    const leafTotal = leaves.reduce((sum, leaf) => sum + leaf.size, 0);
    if (leafTotal <= 0) return [];

    const frameArea = Math.max(size.width * size.height, 1);
    const floor = Math.max(1, Math.floor((leafTotal * (MIN_TILE_EDGE * MIN_TILE_EDGE)) / frameArea));
    const rects = squarify(
      leaves.map((file) => ({
        id: file.path,
        size: Math.max(file.size, floor),
      })),
      0,
      0,
      size.width,
      size.height,
    );
    const byPath = new Map(leaves.map((file) => [file.path, file]));
    return rects
      .map((rect) => {
        const file = byPath.get(rect.id);
        if (!file) return null;
        const width = Math.max(0, rect.width - gap);
        const height = Math.max(0, rect.height - gap);
        if (width < MIN_TILE_EDGE - 1 || height < MIN_TILE_EDGE - 1) return null;
        return {
          ...file,
          x: rect.x + gap / 2,
          y: rect.y + gap / 2,
          width: Math.max(width, MIN_TILE_EDGE),
          height: Math.max(height, MIN_TILE_EDGE),
          fill: fillFor(file, light),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [files, light, showMap, size.height, size.width, total]);

  function clearHover(): void {
    setHover(null);
  }

  function setHoverAt(leaf: TreemapFileLeaf, clientX: number, clientY: number): void {
    if (isAggregateLeaf(leaf)) {
      clearHover();
      return;
    }
    const frame = frameEl?.getBoundingClientRect();
    setHover({
      leaf,
      x: frame ? clientX - frame.left : clientX,
      y: frame ? clientY - frame.top : clientY,
    });
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)} aria-label="Storage treemap">
      <div className="flex items-center gap-2 px-4 py-3">
        <TreemapIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Storage
        </h2>
        <span className="ml-auto truncate text-[11px] text-muted-foreground">
          {total > 0 ? formatBytes(total) : ""}
          {scan?.fileCount ? `${total > 0 ? " · " : ""}${scan.fileCount.toLocaleString()} items` : ""}
        </span>
      </div>

      <div className="min-h-0 flex-1 px-3 pb-2">
        {scanning && !showMap ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Mapping this folder…
          </div>
        ) : !showMap ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 text-center">
            <p className="text-sm text-muted-foreground">
              Size map appears here once this folder is scanned. Double-click a folder to zoom in.
            </p>
          </div>
        ) : (
          <div
            ref={setFrameEl}
            className="relative h-full min-h-[160px] overflow-hidden rounded-xl bg-muted"
            role="list"
            aria-label="Storage size map"
            onPointerLeave={clearHover}
          >
            {layout.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {scanning ? "Mapping this folder…" : "Preparing size map…"}
              </div>
            ) : (
              layout.map((cell) => {
                const selected = selectedPath != null && samePath(selectedPath, cell.path);
                const showName =
                  cell.width >= 28 && cell.height >= 16 && !isAggregateLeaf(cell);
                return (
                  <button
                    key={cell.path}
                    type="button"
                    role="listitem"
                    aria-label={`${cell.name}, ${kindLabelFor(cell)}, ${formatBytes(cell.size)}${
                      cell.isDirectory ? ", double-click to zoom" : ""
                    }`}
                    className={cn(
                      "absolute overflow-hidden border border-border/40 text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      selected && "z-10 ring-1 ring-ring",
                      isAggregateLeaf(cell) ? "cursor-default opacity-80" : "cursor-pointer",
                    )}
                    style={{
                      left: cell.x,
                      top: cell.y,
                      width: cell.width,
                      height: cell.height,
                      backgroundColor: cell.fill,
                      minWidth: MIN_TILE_EDGE,
                      minHeight: MIN_TILE_EDGE,
                    }}
                    onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
                      setHoverAt(cell, event.clientX, event.clientY);
                    }}
                    onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
                      if (!hover || !samePath(hover.leaf.path, cell.path)) return;
                      const frame = frameEl?.getBoundingClientRect();
                      if (!frame) return;
                      setHover({
                        leaf: cell,
                        x: event.clientX - frame.left,
                        y: event.clientY - frame.top,
                      });
                    }}
                    onClick={() => {
                      if (isAggregateLeaf(cell)) return;
                      onSelect?.(cell);
                    }}
                    onDoubleClick={() => {
                      if (isAggregateLeaf(cell)) return;
                      if (cell.isDirectory) onZoom?.(cell);
                      else onOpen?.(cell);
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (isAggregateLeaf(cell)) return;
                        onSelect?.(cell);
                      }
                    }}
                  >
                    {showName ? (
                      <span className="block truncate px-0.5 pt-0.5 text-[10px] font-medium text-foreground">
                        {cell.name}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}

            {hover ? (
              <HoverCard
                leaf={hover.leaf}
                x={hover.x}
                y={hover.y}
                frameWidth={size.width}
                frameHeight={size.height}
              />
            ) : null}

            {scanning ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1 text-center text-[10px] text-muted-foreground">
                Updating map…
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function HoverCard({
  leaf,
  x,
  y,
  frameWidth,
  frameHeight,
}: {
  leaf: TreemapFileLeaf;
  x: number;
  y: number;
  frameWidth: number;
  frameHeight: number;
}) {
  const cardW = Math.min(200, Math.max(132, frameWidth - 16));
  const cardH = 72;
  const left = Math.min(Math.max(8, x + 12), Math.max(8, frameWidth - cardW - 8));
  const top = Math.min(Math.max(8, y + 12), Math.max(8, frameHeight - cardH - 8));

  return (
    <div
      className="pointer-events-none absolute z-20 rounded-md border border-border bg-card px-2.5 py-2 shadow-sm"
      style={{ left, top, width: cardW }}
      role="tooltip"
    >
      <p className="truncate text-[12px] font-medium text-foreground" title={leaf.name}>
        {leaf.name}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {kindLabelFor(leaf)}
        <span className="mx-1.5 opacity-50">·</span>
        {formatBytes(leaf.size)}
      </p>
    </div>
  );
}

/** Compact treemap glyph for the Folders chrome toggle. */
export function TreemapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="1.5" y="1.5" width="8" height="13" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="1.5" width="3.5" height="7" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="10" width="3.5" height="4.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
