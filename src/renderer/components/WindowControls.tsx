import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { hostIsMac } from "../lib/platform";
import { cn } from "../lib/utils";

function CaptionButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "no-drag inline-flex h-8 w-9 shrink-0 items-center justify-center text-muted-foreground outline-none transition-colors duration-150",
        "hover:bg-select hover:text-foreground",
        className,
      )}
      // Keep caption hits out of Electron drag-region hit-testing.
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/** Minimal Win/Linux caption buttons — no tooltips, no oversized plates. */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const isMac = hostIsMac();
  const api = window.entropy?.window;

  useEffect(() => {
    if (isMac || !api) return;
    let cancelled = false;
    void api.isMaximized().then((value) => {
      if (!cancelled) setMaximized(value);
    });
    return () => {
      cancelled = true;
    };
  }, [isMac, api]);

  if (isMac || !api) return null;

  return (
    <div className="no-drag flex h-8 shrink-0 items-center" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
      <CaptionButton
        label="Minimize"
        onClick={() => {
          void api.minimize().catch(() => undefined);
        }}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
      </CaptionButton>
      <CaptionButton
        label={maximized ? "Restore" : "Maximize"}
        onClick={() => {
          void api
            .maximize()
            .then(() => api.isMaximized())
            .then(setMaximized)
            .catch(() => undefined);
        }}
      >
        <Square className="h-3 w-3" strokeWidth={1.5} />
      </CaptionButton>
      <CaptionButton
        label="Close"
        onClick={() => {
          void api.close().catch(() => undefined);
        }}
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
      </CaptionButton>
    </div>
  );
}
