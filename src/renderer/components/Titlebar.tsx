import {
  ArrowLeftRight,
  Command,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { WindowControls } from "./WindowControls";

interface TitlebarProps {
  workspaceName?: string;
  onCloseWorkspace?: () => void;
  onOpenSearch?: () => void;
  onOpenCommands?: () => void;
  onOpenSettings?: () => void;
}

export function Titlebar({
  workspaceName,
  onCloseWorkspace,
  onOpenSearch,
  onOpenCommands,
  onOpenSettings,
}: TitlebarProps) {
  return (
    <header className="drag-region flex h-10 shrink-0 items-center justify-between border-b border-border bg-ink pl-3 pr-0">
      <div className="flex min-w-0 items-center gap-2 pl-[env(titlebar-area-x,0px)]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Entropy
        </span>
        {workspaceName ? (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="truncate text-sm text-foreground">{workspaceName}</span>
          </>
        ) : null}
      </div>

      <div className="no-drag flex items-center gap-0.5 pr-1">
        {onOpenCommands ? (
          <TitlebarIconButton label="Commands" shortcut="Ctrl P" onClick={onOpenCommands}>
            <Command strokeWidth={1.75} />
          </TitlebarIconButton>
        ) : null}
        {onOpenSearch ? (
          <TitlebarIconButton label="Search" shortcut="Ctrl K" onClick={onOpenSearch}>
            <Search strokeWidth={1.75} />
          </TitlebarIconButton>
        ) : null}
        {onOpenSettings ? (
          <TitlebarIconButton label="Settings" shortcut="Ctrl ," onClick={onOpenSettings}>
            <Settings strokeWidth={1.75} />
          </TitlebarIconButton>
        ) : null}
        {onCloseWorkspace ? (
          <TitlebarIconButton label="Switch workspace" onClick={onCloseWorkspace}>
            <ArrowLeftRight strokeWidth={1.75} />
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
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          aria-label={label}
          onClick={onClick}
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
