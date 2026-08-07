import { useEffect, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../lib/utils";

const TABLE_ROW_HEIGHT = 41;

/** Match `.entropy-gallery-grid` minmax breakpoints in global.css. */
export function galleryColumnCount(width: number): number {
  if (width <= 0) return 1;
  let minPx = 9.5 * 16;
  let gapPx = 0.75 * 16;
  if (width >= 68 * 16) {
    minPx = 12.5 * 16;
    gapPx = 16;
  } else if (width >= 52 * 16) {
    minPx = 11.5 * 16;
    gapPx = 16;
  } else if (width >= 36 * 16) {
    minPx = 10.5 * 16;
    gapPx = 0.85 * 16;
  }
  return Math.max(1, Math.floor((width + gapPx) / (minPx + gapPx)));
}

export function galleryGapPx(width: number): number {
  if (width >= 52 * 16) return 16;
  if (width >= 36 * 16) return 0.85 * 16;
  return 0.75 * 16;
}

/** Approximate gallery card height from column width (square face + label + padding). */
export function galleryRowHeight(columnWidth: number): number {
  return Math.round(columnWidth + 72);
}

interface VirtualTableBodyProps {
  count: number;
  className?: string;
  children: (index: number) => ReactNode;
}

/** Windowed table body — only mounts rows near the viewport. */
export function VirtualTableBody({ count, className, children }: VirtualTableBodyProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => TABLE_ROW_HEIGHT,
    overscan: 14,
  });

  return (
    <div
      ref={parentRef}
      className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden", className)}
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            className="absolute left-0 top-0 w-full"
            style={{
              height: `${item.size}px`,
              transform: `translateY(${item.start}px)`,
            }}
          >
            {children(item.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

interface VirtualGalleryGridProps {
  count: number;
  className?: string;
  children: (index: number) => ReactNode;
}

/** Windowed gallery grid — unmounts cards that leave the viewport. */
export function VirtualGalleryGrid({ count, className, children }: VirtualGalleryGridProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = parentRef.current;
    if (!node) return;
    const measure = (): void => {
      setWidth(node.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const columns = galleryColumnCount(width);
  const gap = galleryGapPx(width);
  const columnWidth =
    width > 0 ? Math.max(1, (width - gap * (columns - 1)) / columns) : 152;
  const rowCount = count === 0 ? 0 : Math.ceil(count / columns);
  const rowHeight = galleryRowHeight(columnWidth);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  });

  return (
    <div
      ref={parentRef}
      className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden", className)}
    >
      <div className="px-6 py-4 pb-6">
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const startIndex = row.index * columns;
            const indices: number[] = [];
            for (let i = 0; i < columns; i += 1) {
              const index = startIndex + i;
              if (index < count) indices.push(index);
            }
            return (
              <div
                key={row.key}
                data-index={row.index}
                className="absolute left-0 top-0 grid w-full"
                style={{
                  height: `${row.size}px`,
                  transform: `translateY(${row.start}px)`,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gap: `${gap}px`,
                }}
              >
                {indices.map((index) => (
                  <div key={index} className="min-w-0">
                    {children(index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
