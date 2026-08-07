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
        "inline-flex h-9 w-10 items-center justify-center text-muted-foreground outline-none transition-colors duration-150",
        "hover:bg-select hover:text-foreground",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Minimal Win/Linux caption buttons — no tooltips, no oversized hit plates. */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const isMac = hostIsMac();
  const canControl = Boolean(window.entropy?.window);

  useEffect(() => {
    if (isMac || !canControl) return;
    let cancelled = false;
    void window.entropy.window.isMaximized().then((value) => {
      if (!cancelled) setMaximized(value);
    });
    return () => {
      cancelled = true;
    };
  }, [isMac, canControl]);

  if (isMac || !canControl) return null;

  return (
    <div className="no-drag flex h-9 items-center">
      <CaptionButton label="Minimize" onClick={() => void window.entropy.window.minimize()}>
        <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
      </CaptionButton>
      <CaptionButton
        label={maximized ? "Restore" : "Maximize"}
        onClick={() => {
          void window.entropy.window.maximize().then(async () => {
            setMaximized(await window.entropy.window.isMaximized());
          });
        }}
      >
        <Square className="h-3 w-3" strokeWidth={1.5} />
      </CaptionButton>
      <CaptionButton label="Close" onClick={() => void window.entropy.window.close()}>
        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
      </CaptionButton>
    </div>
  );
}
