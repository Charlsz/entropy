import {
  ArrowLeftRight,
  Command,
  Search,
} from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface TitlebarProps {
  workspaceName?: string;
  onCloseWorkspace?: () => void;
  onOpenSearch?: () => void;
  onOpenCommands?: () => void;
}

export function Titlebar({
  workspaceName,
  onCloseWorkspace,
  onOpenSearch,
  onOpenCommands,
}: TitlebarProps) {
  return (
    <header className="drag-region flex h-10 shrink-0 items-center justify-between border-b border-border bg-ink px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Entropy
        </span>
        {workspaceName ? (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="truncate text-sm text-foreground">{workspaceName}</span>
          </>
        ) : null}
      </div>

      <div className="no-drag flex items-center gap-0.5">
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
        {onCloseWorkspace ? (
          <TitlebarIconButton label="Switch workspace" onClick={onCloseWorkspace}>
            <ArrowLeftRight strokeWidth={1.75} />
          </TitlebarIconButton>
        ) : null}
        <div className="w-[70px]" aria-hidden />
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
