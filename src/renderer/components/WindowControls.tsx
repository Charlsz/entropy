import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const isMac = window.entropy.platform === "darwin";

  useEffect(() => {
    if (isMac) return;
    void window.entropy.window.isMaximized().then(setMaximized);
  }, [isMac]);

  if (isMac) return null;

  return (
    <div className="ml-1 flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-10 rounded-none text-muted-foreground"
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
            className="h-8 w-10 rounded-none text-muted-foreground"
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
            className="h-8 w-10 rounded-none text-muted-foreground hover:bg-ink-2 hover:text-paper"
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
