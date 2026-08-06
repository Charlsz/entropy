import { X } from "lucide-react";
import { Button } from "./ui/button";
import { osTrashName } from "../lib/platform";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface TrashUndoBarProps {
  fileCount: number;
  reclaimLabel?: string;
  busy?: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

/** Bottom-right toast after delete — Undo restores; dismiss keeps them in the OS trash. */
export function TrashUndoBar({
  fileCount,
  reclaimLabel,
  busy,
  onUndo,
  onDismiss,
}: TrashUndoBarProps) {
  const trash = osTrashName();
  const count = fileCount.toLocaleString();
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex justify-end"
      role="status"
    >
      <div className="pointer-events-auto flex max-w-[22rem] items-center gap-2 rounded-[8px] border border-border bg-card px-3 py-2.5 text-foreground shadow-sm">
        <p className="min-w-0 flex-1 text-[13px] leading-snug">
          <span className="font-medium">
            {count === "1" ? "Moved" : `${count} moved`} to {trash}
          </span>
          {reclaimLabel ? (
            <span className="text-muted-foreground"> · {reclaimLabel}</span>
          ) : null}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={busy}
            onClick={onUndo}
          >
            Undo
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                disabled={busy}
                aria-label="Dismiss"
                onClick={onDismiss}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dismiss</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
