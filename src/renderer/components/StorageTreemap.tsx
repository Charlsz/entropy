import { useMemo, useState, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { HardDrive } from "lucide-react";
import type { FileEntry, NoteSearchResult, TreemapFileLeaf, TreemapScanResult } from "../../shared/types";
import {
  FILE_KIND_FILL,
  FILE_KIND_LABEL,
  FILE_KIND_ORDER,
  type FileKindId,
} from "../../shared/fileKinds";
import { cn } from "../lib/utils";
import { squarify } from "../lib/squarify";

const FOLDER_FILL = "#2c3136";

interface StorageTreemapProps {
  scan?: TreemapScanResult | null;
  selectedPath?: string | null;
  scanning?: boolean;
  workspacePath?: string | null;
  scanRoot?: string | null;
  recentFiles?: string[];
  onSelect?: (leaf: TreemapFileLeaf) => void;
  onOpen?: (leaf: TreemapFileLeaf) => void;
  onZoom?: (leaf: TreemapFileLeaf) => void;
  className?: string;
}

interface HoverIntel {
  noteRefs: NoteSearchResult[];
  duplicates: FileEntry[];
  loading: boolean;
}

interface HoverState {
  leaf: TreemapFileLeaf;
  x: number;
  y: number;
  intel: HoverIntel;
}

function isAggregateLeaf(leaf: TreemapFileLeaf): boolean {
  return leaf.path.endsWith(".__entropy_other__") || leaf.name.startsWith("Other (");
}

function samePathKey(a: string, b: string): boolean {
  return a.replace(/[/\\]+$/, "").toLowerCase() === b.replace(/[/\\]+$/, "").toLowerCase();
}

function kindLabelFor(leaf: TreemapFileLeaf): string {
  if (leaf.isDirectory) return "Folder";
  const label = FILE_KIND_LABEL[leaf.kind];
  // Singular for hover card (Archives → Archive)
  if (label.endsWith("s") && label !== "Other") return label.slice(0, -1);
  return label;
}

function fillFor(leaf: TreemapFileLeaf): string {
  if (leaf.isDirectory) return FOLDER_FILL;
  return FILE_KIND_FILL[leaf.kind];
}

function deleteHint(intel: HoverIntel, isDirectory: boolean): string | null {
  if (isDirectory) return null;
  if (intel.loading) return null;
  if (intel.noteRefs.length > 0) return "Referenced in notes — review before deleting";
  if (intel.duplicates.length > 0) return "Has duplicates — one copy may be removable";
  return "No note references found";
}

export function StorageTreemap({
  scan = null,
  selectedPath = null,
  scanning = false,
  workspacePath = null,
  scanRoot = null,
  recentFiles = [],
  onSelect,
  onOpen,
  onZoom,
  className,
}: StorageTreemapProps) {
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverToken = useRef(0);

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

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const kindTotals = useMemo(() => {
    const map = new Map<FileKindId, { size: number; count: number }>();
    for (const file of files) {
      if (isAggregateLeaf(file) || file.isDirectory) continue;
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
          fill: fillFor(file),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [files, showMap, size.height, size.width]);

  function clearHover(): void {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    hoverToken.current += 1;
    setHover(null);
  }

  function scheduleHover(leaf: TreemapFileLeaf, clientX: number, clientY: number): void {
    if (isAggregateLeaf(leaf)) {
      clearHover();
      return;
    }
    if (hoverTimer.current) clearTimeout(hoverTimer.current);

    const frame = frameEl?.getBoundingClientRect();
    const x = frame ? clientX - frame.left : clientX;
    const y = frame ? clientY - frame.top : clientY;

    setHover({
      leaf,
      x,
      y,
      intel: { noteRefs: [], duplicates: [], loading: !leaf.isDirectory },
    });

    if (leaf.isDirectory) return;

    hoverTimer.current = setTimeout(() => {
      const token = ++hoverToken.current;
      void (async () => {
        const [noteRefs, duplicates] = await Promise.all([
          workspacePath
            ? window.entropy.fs.findFileReferences(workspacePath, leaf.path).catch(() => [])
            : Promise.resolve([]),
          scanRoot
            ? window.entropy.fs.findDuplicates(scanRoot, leaf.path).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (token !== hoverToken.current) return;
        setHover((prev) =>
          prev && samePathKey(prev.leaf.path, leaf.path)
            ? { ...prev, intel: { noteRefs, duplicates, loading: false } }
            : prev,
        );
      })();
    }, 160);
  }

  function lastOpenedLabel(leaf: TreemapFileLeaf): string {
    const hit = recentFiles.some((item) => samePathKey(item, leaf.path));
    return hit ? "Recently" : "Never";
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)} aria-label="Storage treemap">
      <div className="flex items-center gap-2 px-4 py-3">
        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
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
            className="relative h-full min-h-[160px] overflow-hidden rounded-xl bg-ink"
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
                const selected = selectedPath === cell.path;
                const isHovered = Boolean(hover && samePathKey(hover.leaf.path, cell.path));
                // Hide the in-cell name while the hover card is up — avoids duplicate "Downloads".
                const showLabel =
                  cell.width > 64 &&
                  cell.height > 36 &&
                  !isAggregateLeaf(cell) &&
                  !isHovered;
                return (
                  <button
                    key={cell.path}
                    type="button"
                    role="listitem"
                    aria-label={`${cell.name}, ${kindLabelFor(cell)}, ${formatBytes(cell.size)}${
                      cell.isDirectory ? ", double-click to zoom" : ""
                    }`}
                    className={cn(
                      "absolute overflow-hidden border border-black/30 p-1 text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      selected && "z-10 ring-1 ring-ring",
                      isAggregateLeaf(cell) ? "cursor-default opacity-80" : "cursor-pointer",
                    )}
                    style={{
                      left: cell.x,
                      top: cell.y,
                      width: cell.width,
                      height: cell.height,
                      backgroundColor: cell.fill,
                    }}
                    onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
                      scheduleHover(cell, event.clientX, event.clientY);
                    }}
                    onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
                      if (!hover || !samePathKey(hover.leaf.path, cell.path)) return;
                      const frame = frameEl?.getBoundingClientRect();
                      if (!frame) return;
                      setHover((prev) =>
                        prev
                          ? {
                              ...prev,
                              x: event.clientX - frame.left,
                              y: event.clientY - frame.top,
                            }
                          : prev,
                      );
                    }}
                    onClick={() => {
                      if (isAggregateLeaf(cell)) return;
                      onSelect?.(cell);
                    }}
                    onDoubleClick={() => {
                      if (isAggregateLeaf(cell)) return;
                      if (cell.isDirectory) {
                        onZoom?.(cell);
                        return;
                      }
                      onOpen?.(cell);
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                      if (event.key !== "Enter" || isAggregateLeaf(cell)) return;
                      if (cell.isDirectory) onZoom?.(cell);
                      else onOpen?.(cell);
                    }}
                  >
                    {showLabel ? (
                      <span className="flex h-full min-h-0 flex-col justify-between">
                        <span className="truncate text-[10px] font-medium text-foreground">
                          {cell.name}
                        </span>
                        <span className="truncate text-[9px] text-muted-foreground">
                          {cell.isDirectory ? `Folder · ${formatBytes(cell.size)}` : formatBytes(cell.size)}
                        </span>
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
                intel={hover.intel}
                lastOpened={lastOpenedLabel(hover.leaf)}
                hint={deleteHint(hover.intel, !!hover.leaf.isDirectory)}
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
              Tiny items are grouped as Other so every region stays readable.
            </p>
          ) : null}
        </div>
      ) : scan?.truncated ? (
        <div className="shrink-0 border-t border-border px-3 py-2">
          <p className="text-[10px] text-muted-foreground">
            Tiny items are grouped as Other so every region stays readable.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function HoverCard({
  leaf,
  x,
  y,
  frameWidth,
  frameHeight,
  intel,
  lastOpened,
  hint,
}: {
  leaf: TreemapFileLeaf;
  x: number;
  y: number;
  frameWidth: number;
  frameHeight: number;
  intel: HoverIntel;
  lastOpened: string;
  hint: string | null;
}) {
  const cardW = 220;
  const cardH = leaf.isDirectory ? 120 : 210;
  const left = Math.min(Math.max(8, x + 14), Math.max(8, frameWidth - cardW - 8));
  const top = Math.min(Math.max(8, y + 14), Math.max(8, frameHeight - cardH - 8));
  const location = leaf.location || "—";
  const dupCount = intel.duplicates.length;
  const noteCount = intel.noteRefs.length;

  return (
    <div
      className="pointer-events-none absolute z-20 w-[220px] rounded-lg border border-border bg-ink p-3"
      style={{ left, top }}
      role="tooltip"
    >
      <p className="truncate text-[12px] font-semibold text-foreground" title={leaf.name}>
        {leaf.name}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {kindLabelFor(leaf)}
        <span className="mx-1.5 text-border">·</span>
        {formatBytes(leaf.size)}
      </p>

      <dl className="mt-2.5 space-y-1.5 text-[11px]">
        <Row label="Location" value={location} />
        {!leaf.isDirectory ? (
          <>
            <Row label="Last opened" value={lastOpened} />
            <Row
              label="Referenced in notes"
              value={intel.loading ? "…" : String(noteCount)}
            />
            <Row
              label="Duplicate copies"
              value={intel.loading ? "…" : String(dupCount)}
            />
          </>
        ) : (
          <Row label="Action" value="Double-click to zoom" />
        )}
      </dl>

      {!leaf.isDirectory && !intel.loading && dupCount > 0 ? (
        <ul className="mt-2 max-h-14 space-y-1 overflow-hidden border-t border-border/60 pt-2">
          {intel.duplicates.slice(0, 2).map((dup) => (
            <li key={dup.path} className="truncate text-[10px] text-muted-foreground" title={dup.path}>
              {dup.path.split(/[/\\]/).slice(-2).join(" › ")}
            </li>
          ))}
          {dupCount > 2 ? (
            <li className="text-[10px] text-muted-foreground">+{dupCount - 2} more</li>
          ) : null}
        </ul>
      ) : null}

      {hint ? (
        <p className="mt-2 border-t border-border/60 pt-2 text-[10px] leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium text-foreground/90">{value}</dd>
    </div>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
