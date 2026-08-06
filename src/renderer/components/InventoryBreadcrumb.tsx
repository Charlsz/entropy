import { Fragment } from "react";
import { HardDrive } from "lucide-react";
import { useWorkspace } from "../state/useWorkspace";
import { figma } from "../lib/figmaTokens";
import { cn } from "../lib/utils";

/** Figma breadcrumb: drive · / · Documents / Projects / Mercury */
export function InventoryBreadcrumb({
  className,
  trailing,
}: {
  className?: string;
  trailing?: string;
}) {
  const { workspace, inventoryCrumbs, goToInventoryCrumb } = useWorkspace();
  const rootLabel = workspace.inventoryRootLabel || "Home";
  const hasTrail = Boolean(workspace.inventoryScanRoot);

  if (!hasTrail) return null;

  // Gallery frame: `/ Documents / Gallery Perspective`
  if (trailing) {
    const first = inventoryCrumbs[0] ?? rootLabel;
    return (
      <nav
        className={cn("flex min-w-0 items-center gap-2 px-6 py-3", className)}
        style={{ backgroundColor: figma.canvas, borderBottom: `1px solid ${figma.border}` }}
        aria-label="Current folder"
      >
        <HardDrive className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />
        <span className="font-mono text-[12px]" style={{ color: figma.muted }}>
          /
        </span>
        <button
          type="button"
          className="shrink-0 text-[13px]"
          style={{ color: figma.muted }}
          onClick={() => void goToInventoryCrumb(inventoryCrumbs.length > 0 ? 0 : -1)}
        >
          {first}
        </button>
        <span className="font-mono text-[12px]" style={{ color: figma.muted }}>
          /
        </span>
        <span className="truncate text-[13px] font-medium" style={{ color: figma.ink }}>
          {trailing}
        </span>
      </nav>
    );
  }

  return (
    <nav
      className={cn("flex min-w-0 items-center gap-2 px-6 py-3", className)}
      style={{ backgroundColor: figma.canvas, borderBottom: `1px solid ${figma.border}` }}
      aria-label="Current folder"
    >
      <HardDrive className="size-[14px] shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />
      <span className="font-mono text-[12px]" style={{ color: figma.muted }}>
        /
      </span>
      {inventoryCrumbs.length === 0 ? (
        <span className="text-[13px] font-medium" style={{ color: figma.ink }}>
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
    </nav>
  );
}
