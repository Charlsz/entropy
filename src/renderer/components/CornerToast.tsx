import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "../lib/utils";

interface CornerToastProps {
  children: ReactNode;
  onDismiss: () => void;
  busy?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Compact bottom-right status toast — delete undo, clipboard confirm, etc. */
export function CornerToast({
  children,
  onDismiss,
  busy,
  actionLabel,
  onAction,
  className,
}: CornerToastProps) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-[min(22rem,calc(100vw-2rem))] justify-end"
      role="status"
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1.5 text-foreground shadow-sm",
          className,
        )}
      >
        <div className="min-w-0 flex-1 text-[12px] leading-snug">{children}</div>
        <div className="flex shrink-0 items-center gap-0.5">
          {actionLabel && onAction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px]"
              disabled={busy}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                disabled={busy}
                aria-label="Dismiss"
                onClick={onDismiss}
              >
                <X className="h-3 w-3" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dismiss</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
