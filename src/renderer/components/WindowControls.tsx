import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import { hostIsMac } from "../lib/platform";

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
    <div className="no-drag ml-1 flex h-10 items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none text-muted-foreground"
            aria-label="Minimize"
            onClick={() => void window.entropy.window.minimize()}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Minimize</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none text-muted-foreground"
            aria-label={maximized ? "Restore" : "Maximize"}
            onClick={() => {
              void window.entropy.window.maximize().then(async () => {
                setMaximized(await window.entropy.window.isMaximized());
              });
            }}
          >
            <Square className="h-3 w-3" strokeWidth={1.75} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{maximized ? "Restore" : "Maximize"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none text-muted-foreground hover:bg-ink-2 hover:text-paper"
            aria-label="Close"
            onClick={() => void window.entropy.window.close()}
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Close</TooltipContent>
      </Tooltip>
    </div>
  );
}
