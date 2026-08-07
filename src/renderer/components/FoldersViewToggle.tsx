import { cn } from "../lib/utils";

export type FoldersViewMode = "list" | "gallery";

interface FoldersViewToggleProps {
  value: FoldersViewMode;
  onChange: (value: FoldersViewMode) => void;
  className?: string;
}

/**
 * Compact List | Gallery segmented control for Folders chrome.
 * Adapted from pixel-perfect free/premium toggle — Entropy tokens, no spring bounce.
 */
export function FoldersViewToggle({ value, onChange, className }: FoldersViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Folders view"
      className={cn(
        "relative flex h-7 shrink-0 items-center rounded-full border border-border bg-secondary p-0.5",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-select transition-transform duration-150 ease-out"
        style={{
          transform: value === "list" ? "translateX(2px)" : "translateX(calc(100% + 2px))",
        }}
      />
      <button
        type="button"
        className={cn(
          "relative z-10 flex h-6 flex-1 items-center justify-center rounded-full px-2.5 text-[11px] font-medium outline-none transition-colors duration-150",
          value === "list" ? "text-foreground" : "text-muted-foreground",
        )}
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
      >
        List
      </button>
      <button
        type="button"
        className={cn(
          "relative z-10 flex h-6 flex-1 items-center justify-center rounded-full px-2.5 text-[11px] font-medium outline-none transition-colors duration-150",
          value === "gallery" ? "text-foreground" : "text-muted-foreground",
        )}
        aria-pressed={value === "gallery"}
        onClick={() => onChange("gallery")}
      >
        Gallery
      </button>
    </div>
  );
}
