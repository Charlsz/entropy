import { useContext } from "react";
import { ArrowLeft, ArrowRight, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { WindowControls } from "./WindowControls";
import { WorkspaceContext } from "../state/WorkspaceContext";
import { cn } from "../lib/utils";

interface TitlebarProps {
  workspaceName?: string;
  onCloseWorkspace?: () => void;
  onOpenSettings?: () => void;
}

/**
 * Minimal Electron caption strip — product chrome lives in AppSidebar.
 * The bar itself is the drag region; controls use `no-drag`.
 */
export function Titlebar({
  workspaceName,
  onCloseWorkspace,
  onOpenSettings,
}: TitlebarProps) {
  const workspaceCtx = useContext(WorkspaceContext);

  return (
    <header className="drag-region relative flex h-9 shrink-0 items-center border-b border-border bg-background pl-2 pr-0">
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
        {workspaceName && onCloseWorkspace ? (
          <button
            type="button"
            className="no-drag ml-1 inline-flex h-7 max-w-[12rem] items-center gap-2 rounded-md px-2 text-left hover:bg-select"
            onClick={onCloseWorkspace}
            title="Switch workspace"
          >
            <span className="truncate text-xs font-medium text-foreground">{workspaceName}</span>
          </button>
        ) : (
          <span className="ml-2 select-none text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Entropy
          </span>
        )}
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
