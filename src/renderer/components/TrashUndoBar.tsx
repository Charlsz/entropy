import { CornerToast } from "./CornerToast";
import { osTrashName } from "../lib/platform";

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
    <CornerToast
      busy={busy}
      actionLabel="Undo"
      onAction={onUndo}
      onDismiss={onDismiss}
    >
      <p>
        <span className="font-medium">
          {count === "1" ? "Moved" : `${count} moved`} to {trash}
        </span>
        {reclaimLabel ? (
          <span className="text-muted-foreground"> · {reclaimLabel}</span>
        ) : null}
      </p>
    </CornerToast>
  );
}
