import { Fragment, useContext } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { WindowControls } from "./WindowControls";
import { WorkspaceContext } from "../state/WorkspaceContext";
import { cn } from "../lib/utils";

interface TitlebarProps {
  workspaceName?: string;
  sidebarCollapsed?: boolean;
  contextCollapsed?: boolean;
  showPanelToggles?: boolean;
  onToggleSidebar?: () => void;
  onToggleContext?: () => void;
  onCloseWorkspace?: () => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
}

export function Titlebar({
  workspaceName,
  sidebarCollapsed = false,
  contextCollapsed = false,
  showPanelToggles = false,
  onToggleSidebar,
  onToggleContext,
  onCloseWorkspace,
  onOpenSearch,
  onOpenSettings,
}: TitlebarProps) {
  const workspaceCtx = useContext(WorkspaceContext);
  const rootLabel = workspaceCtx?.workspace.inventoryRootLabel || "Home";
  const hasTrail = Boolean(workspaceCtx?.workspace.inventoryScanRoot);
  const inventoryCrumbs = workspaceCtx?.inventoryCrumbs ?? [];

  return (
    <header className="drag-region flex h-10 shrink-0 items-center gap-1 border-b border-border bg-ink pl-2 pr-0">
      <div className="no-drag flex min-w-0 flex-1 items-center gap-0.5 pl-[env(titlebar-area-x,0px)]">
        {showPanelToggles ? (
          <>
            <TitlebarIconButton
              label="Toggle left sidebar"
              pressed={!sidebarCollapsed}
              onClick={onToggleSidebar}
            >
              <PanelLeft strokeWidth={1.75} />
            </TitlebarIconButton>
            <TitlebarIconButton
              label="Toggle right sidebar"
              pressed={!contextCollapsed}
              onClick={onToggleContext}
            >
              <PanelRight strokeWidth={1.75} />
            </TitlebarIconButton>
            <div className="mx-1 h-4 w-px bg-border" aria-hidden />
          </>
        ) : null}

        {workspaceCtx ? (
          <>
            <TitlebarIconButton
              label="Back"
              onClick={workspaceCtx.canGoBack ? workspaceCtx.goBack : undefined}
            >
              <ArrowLeft strokeWidth={1.75} />
            </TitlebarIconButton>
            <TitlebarIconButton
              label="Forward"
              onClick={workspaceCtx.canGoForward ? workspaceCtx.goForward : undefined}
            >
              <ArrowRight strokeWidth={1.75} />
            </TitlebarIconButton>

            {hasTrail ? (
              <Breadcrumb className="ml-1 min-w-0 max-w-[min(42vw,28rem)]">
                <BreadcrumbList className="flex-nowrap gap-1 text-[12px] font-medium text-foreground/55">
                  <BreadcrumbItem className="min-w-0">
                    {inventoryCrumbs.length === 0 ? (
                      <BreadcrumbPage className="truncate text-[12px] font-semibold tracking-tight text-foreground">
                        {rootLabel}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button
                          type="button"
                          className="truncate text-[12px] font-medium text-foreground/70 hover:text-foreground"
                          onClick={() => void workspaceCtx.goToInventoryCrumb(-1)}
                        >
                          {rootLabel}
                        </button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {inventoryCrumbs.map((part, index) => (
                    <Fragment key={`${part}-${index}`}>
                      <BreadcrumbSeparator className="mx-0.5 text-foreground/35 [&>svg]:hidden">
                        <span aria-hidden="true" className="text-[11px] font-normal">
                          ›
                        </span>
                      </BreadcrumbSeparator>
                      <BreadcrumbItem className="min-w-0">
                        {index === inventoryCrumbs.length - 1 ? (
                          <BreadcrumbPage className="truncate text-[12px] font-semibold tracking-tight text-foreground">
                            {part}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <button
                              type="button"
                              className="truncate text-[12px] font-medium text-foreground/70 hover:text-foreground"
                              onClick={() => void workspaceCtx.goToInventoryCrumb(index)}
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
            ) : null}
          </>
        ) : null}

        {onOpenSearch ? (
          <TitlebarIconButton label="Search" className="ml-1 shrink-0" onClick={onOpenSearch}>
            <Search strokeWidth={1.75} />
          </TitlebarIconButton>
        ) : null}
      </div>

      <div className="flex min-w-0 shrink-0 items-center justify-center px-2">
        {workspaceName && onCloseWorkspace ? (
          <button
            type="button"
            className="no-drag group inline-flex max-w-[12rem] items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-ink-2 sm:max-w-[16rem]"
            onClick={onCloseWorkspace}
            title="Switch workspace"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-ink-2 text-[10px] font-semibold uppercase tracking-wide text-paper-2 group-hover:text-paper">
              {workspaceName.slice(0, 1)}
            </span>
            <span className="truncate text-sm text-paper">{workspaceName}</span>
            <ArrowLeftRight
              className="h-3.5 w-3.5 shrink-0 text-paper-2 opacity-70 group-hover:opacity-100"
              strokeWidth={1.75}
            />
          </button>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Entropy
          </span>
        )}
      </div>

      <div className="no-drag flex shrink-0 items-center gap-0.5 pr-1">
        {onOpenSettings ? (
          <TitlebarIconButton label="Settings" onClick={onOpenSettings}>
            <Settings strokeWidth={1.75} />
          </TitlebarIconButton>
        ) : null}
        <WindowControls />
      </div>
    </header>
  );
}

function TitlebarIconButton({
  label,
  onClick,
  pressed,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 shrink-0 text-muted-foreground",
            pressed && "bg-ink-2 text-paper",
            className,
          )}
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          disabled={!onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
