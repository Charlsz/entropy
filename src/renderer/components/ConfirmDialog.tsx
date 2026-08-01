import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { ScrollArea } from "./ui/scroll-area";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[min(90vh,36rem)] overflow-hidden">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {typeof description === "string" ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">{description}</div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Safe-delete preview lists for duplicate cleanup. */
export function DeletePreviewLists({
  deleting,
  keeping,
  reclaimLabel,
}: {
  deleting: string[];
  keeping: string[];
  reclaimLabel?: string;
}) {
  return (
    <div className="space-y-4 text-left">
      {reclaimLabel ? (
        <p className="text-sm text-foreground">
          Reclaim <span className="font-medium">{reclaimLabel}</span>
        </p>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Deleting
        </p>
        <ScrollArea className="max-h-36 rounded-lg border border-border bg-ink-2">
          <ul className="space-y-1 p-3">
            {deleting.map((name) => (
              <li key={name} className="truncate text-sm text-foreground" title={name}>
                {name}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </div>
      {keeping.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Keeping
          </p>
          <ul className="space-y-1 rounded-lg border border-border bg-background p-3">
            {keeping.map((name) => (
              <li key={name} className="truncate text-sm text-foreground" title={name}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Files move to Trash. Use Undo to restore, or recover from Trash until it is emptied.
      </p>
    </div>
  );
}
