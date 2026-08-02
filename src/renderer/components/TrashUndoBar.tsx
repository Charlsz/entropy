import { Button } from "./ui/button";

interface TrashUndoBarProps {
  fileCount: number;
  reclaimLabel?: string;
  busy?: boolean;
  onUndo: () => void;
  onOpenTrash: () => void;
  onDismiss: () => void;
}

/** Post-delete recovery affordance — files stay recoverable until Trash is emptied. */
export function TrashUndoBar({
  fileCount,
  reclaimLabel,
  busy,
  onUndo,
  onOpenTrash,
  onDismiss,
}: TrashUndoBarProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-ink-2 px-4 py-2.5"
      role="status"
    >
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">
          {fileCount.toLocaleString()} file{fileCount === 1 ? "" : "s"} moved to Trash
        </p>
        <p className="text-muted-foreground">
          {reclaimLabel ? `Reclaim ${reclaimLabel} · ` : ""}
          Recoverable from system Trash until emptied
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={busy}
          onClick={onOpenTrash}
        >
          Open Trash
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={busy}
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
