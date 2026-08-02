import { Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { osOpenTrashLabel, osTrashName } from "../lib/platform";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface TrashUndoBarProps {
  fileCount: number;
  reclaimLabel?: string;
  busy?: boolean;
  onUndo: () => void;
  onOpenTrash: () => void;
  onDismiss: () => void;
}

/** Post-delete recovery affordance — files stay in the OS trash until emptied. */
export function TrashUndoBar({
  fileCount,
  reclaimLabel,
  busy,
  onUndo,
  onOpenTrash,
  onDismiss,
}: TrashUndoBarProps) {
  const trash = osTrashName();
  const count = fileCount.toLocaleString();
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-ink-2 px-4 py-2.5"
      role="status"
    >
      <div className="min-w-0 flex-1 basis-[12rem] text-sm">
        <p className="font-medium text-foreground">
          {count === "1" ? "Moved" : `${count} moved`} to {trash}
          {reclaimLabel ? (
            <span className="font-normal text-muted-foreground"> · {reclaimLabel}</span>
          ) : null}
        </p>
      </div>
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
              className="h-7 w-7"
              disabled={busy}
              aria-label={osOpenTrashLabel()}
              onClick={onOpenTrash}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{osOpenTrashLabel()}</TooltipContent>
        </Tooltip>
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
  );
}
