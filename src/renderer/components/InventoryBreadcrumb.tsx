import { Fragment, type ReactNode } from "react";
import { HardDrive } from "lucide-react";
import { useWorkspace } from "../state/useWorkspace";
import { figma } from "../lib/figmaTokens";
import { cn } from "../lib/utils";

/**
 * Library path chrome — single titlebar-height row shared with window controls.
 * Optional trailing actions (sort / refresh) sit before the reserve for overlays.
 */
export function InventoryBreadcrumb({
  className,
  end,
  reserveMapToggle = false,
}: {
  className?: string;
  end?: ReactNode;
  /** Leave room for the storage-map control in the shell title strip. */
  reserveMapToggle?: boolean;
}) {
  const { workspace, inventoryCrumbs, goToInventoryCrumb } = useWorkspace();
  const rootLabel = workspace.inventoryRootLabel || "Home";
  const hasTrail = Boolean(workspace.inventoryScanRoot);

  if (!hasTrail) return null;

  return (
    <nav
      className={cn(
        "drag-region flex h-9 min-w-0 shrink-0 items-center gap-2 border-b px-4",
        reserveMapToggle ? "entropy-titlebar-end--map" : "entropy-titlebar-end",
        className,
      )}
      style={{ backgroundColor: figma.canvas, borderColor: figma.border }}
      aria-label="Current folder"
    >
      <HardDrive
        className="no-drag size-[14px] shrink-0"
        style={{ color: figma.muted }}
        strokeWidth={1.75}
      />
      <span className="no-drag font-mono text-[12px]" style={{ color: figma.muted }}>
        /
      </span>
      <div className="no-drag flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {inventoryCrumbs.length === 0 ? (
          <span className="truncate text-[13px] font-medium" style={{ color: figma.ink }}>
            {rootLabel}
          </span>
        ) : (
          <>
            <button
              type="button"
              className="shrink-0 text-[13px]"
              style={{ color: figma.muted }}
              onClick={() => void goToInventoryCrumb(-1)}
            >
              {rootLabel}
            </button>
            {inventoryCrumbs.map((part, index) => {
              const isLast = index === inventoryCrumbs.length - 1;
              return (
                <Fragment key={`${part}-${index}`}>
                  <span className="font-mono text-[12px]" style={{ color: figma.muted }}>
                    /
                  </span>
                  {isLast ? (
                    <span className="truncate text-[13px] font-medium" style={{ color: figma.ink }}>
                      {part}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="max-w-[8rem] truncate text-[13px]"
                      style={{ color: figma.muted }}
                      onClick={() => void goToInventoryCrumb(index)}
                    >
                      {part}
                    </button>
                  )}
                </Fragment>
              );
            })}
          </>
        )}
      </div>
      {end ? (
        <div className="no-drag ml-auto flex shrink-0 items-center gap-1">{end}</div>
      ) : null}
    </nav>
  );
}
