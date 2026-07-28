import { cn } from "../../lib/utils";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 select-none items-center rounded border border-border bg-ink-2 px-1.5 font-mono text-[10px] font-medium text-paper-2",
        className,
      )}
      {...props}
    />
  );
}
