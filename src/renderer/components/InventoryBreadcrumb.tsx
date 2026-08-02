import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { useWorkspace } from "../state/useWorkspace";

/** Path trail for Inventory gallery: Home > AppData > Roaming */
export function InventoryBreadcrumb() {
  const { workspace, inventoryCrumbs, goToInventoryCrumb } = useWorkspace();
  const rootLabel = workspace.inventoryRootLabel || "Home";
  const hasTrail = Boolean(workspace.inventoryScanRoot);

  if (!hasTrail) return null;

  return (
    <Breadcrumb className="entropy-breadcrumb min-w-0 px-4 pb-2 pt-1" aria-label="Current folder">
      <BreadcrumbList className="flex-nowrap gap-1 text-sm text-muted-foreground">
        <BreadcrumbItem className="shrink-0">
          {inventoryCrumbs.length === 0 ? (
            <BreadcrumbPage className="text-sm font-medium text-foreground">
              {rootLabel}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => void goToInventoryCrumb(-1)}
              >
                {rootLabel}
              </button>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {inventoryCrumbs.map((part, index) => (
          <Fragment key={`${part}-${index}`}>
            <BreadcrumbSeparator className="mx-0.5 shrink-0 text-muted-foreground/50 [&>svg]:hidden">
              <span aria-hidden="true">&gt;</span>
            </BreadcrumbSeparator>
            <BreadcrumbItem className={index === inventoryCrumbs.length - 1 ? "min-w-0" : "shrink-0"}>
              {index === inventoryCrumbs.length - 1 ? (
                <BreadcrumbPage className="truncate text-sm font-medium text-foreground">
                  {part}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    className="max-w-[8rem] truncate text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => void goToInventoryCrumb(index)}
                  >
                    {part}
                  </button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
