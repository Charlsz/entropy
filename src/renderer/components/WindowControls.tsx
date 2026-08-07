import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { hostIsMac } from "../lib/platform";
import { cn } from "../lib/utils";

/** Ultra-minimal Win/Linux window chrome — icon-only, no tooltips or hover washes. */
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
      <button
        type="button"
        aria-label="Minimize"
        onClick={() => void window.entropy.window.minimize()}
        className={chromeBtnClass}
      >
        <Minus className="size-3.5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label={maximized ? "Restore" : "Maximize"}
        onClick={() => {
          void window.entropy.window.maximize().then(async () => {
            setMaximized(await window.entropy.window.isMaximized());
          });
        }}
        className={chromeBtnClass}
      >
        <Square className="size-3" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label="Close"
        onClick={() => void window.entropy.window.close()}
        className={chromeBtnClass}
      >
        <X className="size-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}

const chromeBtnClass = cn(
  "inline-flex h-9 w-9 items-center justify-center text-muted-foreground outline-none",
  "hover:text-foreground focus-visible:text-foreground",
  "bg-transparent shadow-none ring-0",
);
