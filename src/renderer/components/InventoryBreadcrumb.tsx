import { Fragment } from "react";
import { HardDrive } from "lucide-react";
import { useWorkspace } from "../state/useWorkspace";
import { cn } from "../lib/utils";

/** Figma-style trail: drive · / · Documents / Projects / Mercury */
export function InventoryBreadcrumb({
  className,
  trailing,
}: {
  className?: string;
  /** Optional final segment override (e.g. “Gallery Perspective”). */
  trailing?: string;
}) {
  const { workspace, inventoryCrumbs, goToInventoryCrumb } = useWorkspace();
  const rootLabel = workspace.inventoryRootLabel || "Home";
  const hasTrail = Boolean(workspace.inventoryScanRoot);
  const parts = trailing
    ? [...inventoryCrumbs.slice(0, -1), trailing].filter(Boolean)
    : inventoryCrumbs;

  if (!hasTrail) return null;

  return (
    <nav
      className={cn(
        "flex min-w-0 items-center gap-2 border-b border-border bg-background px-6 py-3",
        className,
      )}
      aria-label="Current folder"
    >
      <HardDrive className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className="font-mono text-xs text-muted-foreground">/</span>
      {parts.length === 0 && !trailing ? (
        <button
          type="button"
          className="text-[13px] font-medium text-foreground"
          onClick={() => void goToInventoryCrumb(-1)}
        >
          {rootLabel}
        </button>
      ) : (
        <>
          <button
            type="button"
            className="shrink-0 text-[13px] text-muted-foreground hover:text-foreground"
            onClick={() => void goToInventoryCrumb(-1)}
          >
            {rootLabel}
          </button>
          {parts.map((part, index) => {
            const isLast = index === parts.length - 1;
            return (
              <Fragment key={`${part}-${index}`}>
                <span className="font-mono text-xs text-muted-foreground">/</span>
                {isLast ? (
                  <span className="truncate text-[13px] font-medium text-foreground">{part}</span>
                ) : (
                  <button
                    type="button"
                    className="max-w-[8rem] truncate text-[13px] text-muted-foreground hover:text-foreground"
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
