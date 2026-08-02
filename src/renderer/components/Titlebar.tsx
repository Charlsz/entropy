import { useContext } from "react";
import { ArrowLeft, ArrowLeftRight, ArrowRight, Search, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { WindowControls } from "./WindowControls";
import { WorkspaceContext } from "../state/WorkspaceContext";
import { osModKey } from "../lib/platform";
import { cn } from "../lib/utils";

interface TitlebarProps {
  workspaceName?: string;
  onCloseWorkspace?: () => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
}

/**
 * Frameless caption bar. The header itself is the drag region; only interactive
 * controls use `no-drag` so empty gutters stay grabable like a native titlebar.
 *
 * Workspace title is optically centered in the full bar (absolute), not in a
 * grid middle column — left/right chrome widths differ, which otherwise shifts
 * perceived center even when the math is equal.
 */
export function Titlebar({
  workspaceName,
  onCloseWorkspace,
  onOpenSearch,
  onOpenSettings,
}: TitlebarProps) {
  const workspaceCtx = useContext(WorkspaceContext);

  return (
    <header className="drag-region relative flex h-10 shrink-0 items-center border-b border-border bg-ink pl-2 pr-0">
      <div className="relative z-10 flex min-w-0 flex-1 items-center gap-0.5 pl-[env(titlebar-area-x,0px)]">
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
          </>
        ) : null}

        {onOpenSearch ? (
          <TitlebarIconButton
            label={`Search (${osModKey()}+K)`}
            className="ml-1 shrink-0"
            onClick={onOpenSearch}
          >
            <Search strokeWidth={1.75} />
          </TitlebarIconButton>
        ) : null}
      </div>

      {/* Above side chrome (z-10) so the switcher receives clicks; overlay stays
          pointer-events-none so empty gutters remain window-drag regions. */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <div className="pointer-events-auto max-w-[min(16rem,40vw)] px-2">
          {workspaceName && onCloseWorkspace ? (
            <button
              type="button"
              className="no-drag group inline-flex h-7 max-w-full items-center gap-2 rounded-md px-2 text-left leading-none hover:bg-ink-2"
              onClick={onCloseWorkspace}
              title="Switch workspace"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-ink-2 text-[10px] font-semibold uppercase tracking-wide text-paper-2 group-hover:text-paper">
                {workspaceName.slice(0, 1)}
              </span>
              <span className="truncate text-sm leading-none text-paper">{workspaceName}</span>
              <ArrowLeftRight
                className="h-3.5 w-3.5 shrink-0 text-paper-2 opacity-70 group-hover:opacity-100"
                strokeWidth={1.75}
              />
            </button>
          ) : (
            <span className="select-none text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-muted-foreground">
              Entropy
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 items-center justify-end gap-0.5 pr-1">
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
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
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
          className={cn("no-drag h-7 w-7 shrink-0 text-muted-foreground", className)}
          aria-label={label}
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
