import { Button } from "./ui/button";

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

      <div className="no-drag flex items-center gap-1">
        {onOpenCommands ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={onOpenCommands}
          >
            Commands
          </Button>
        ) : null}
        {onOpenSearch ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={onOpenSearch}
          >
            Search
          </Button>
        ) : null}
        {onCloseWorkspace ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={onCloseWorkspace}
          >
            Switch
          </Button>
        ) : null}
        <div className="w-[70px]" aria-hidden />
      </div>
    </header>
  );
}
