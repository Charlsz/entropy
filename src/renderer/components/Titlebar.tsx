import {
  ArrowLeftRight,
  Command,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { WindowControls } from "./WindowControls";
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
  onOpenCommands?: () => void;
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
  onOpenCommands,
  onOpenSettings,
}: TitlebarProps) {
  return (
    <header className="drag-region flex h-10 shrink-0 items-center gap-1 border-b border-border bg-ink pl-2 pr-0">
      <div className="no-drag flex shrink-0 items-center gap-0.5 pl-[env(titlebar-area-x,0px)]">
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

        {onOpenSearch ? (
          <TitlebarIconButton label="Search" shortcut="Ctrl K" onClick={onOpenSearch}>
            <Search strokeWidth={1.75} />
          </TitlebarIconButton>
        ) : null}
        {onOpenCommands ? (
          <TitlebarIconButton label="Commands" shortcut="Ctrl P" onClick={onOpenCommands}>
            <Command strokeWidth={1.75} />
          </TitlebarIconButton>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center px-2">
        {workspaceName && onCloseWorkspace ? (
          <button
            type="button"
            className="no-drag group inline-flex max-w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-ink-2"
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
          <TitlebarIconButton label="Settings" shortcut="Ctrl ," onClick={onOpenSettings}>
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
  shortcut,
  onClick,
  pressed,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  pressed?: boolean;
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
            "h-7 w-7 text-muted-foreground",
            pressed && "bg-ink-2 text-paper",
          )}
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          disabled={!onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {shortcut ? <span className="ml-2 opacity-60">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
