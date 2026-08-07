import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { hostIsMac } from "../lib/platform";
import { cn } from "../lib/utils";

/** Ultra-minimal Win/Linux window chrome — no button surfaces or hover washes. */
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
    const onResize = () => {
      void window.entropy.window.isMaximized().then((value) => {
        if (!cancelled) setMaximized(value);
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [isMac, canControl]);

  if (isMac || !canControl) return null;

  return (
    <div className="no-drag flex h-9 items-center" role="group" aria-label="Window">
      <ChromeButton
        label="Minimize"
        onClick={() => void window.entropy.window.minimize()}
      >
        <Minus className="size-3.5" strokeWidth={1.5} />
      </ChromeButton>
      <ChromeButton
        label={maximized ? "Restore" : "Maximize"}
        onClick={() => {
          void window.entropy.window.maximize().then(async () => {
            setMaximized(await window.entropy.window.isMaximized());
          });
        }}
      >
        <Square className="size-3" strokeWidth={1.5} />
      </ChromeButton>
      <ChromeButton
        label="Close"
        onClick={() => void window.entropy.window.close()}
      >
        <X className="size-3.5" strokeWidth={1.5} />
      </ChromeButton>
    </div>
  );
}

function ChromeButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center text-muted-foreground outline-none",
            "hover:text-foreground focus-visible:text-foreground",
            "bg-transparent shadow-none ring-0",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
