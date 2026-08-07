import { cn } from "../lib/utils";

export type FoldersViewMode = "list" | "gallery";

interface FoldersViewToggleProps {
  value: FoldersViewMode;
  onChange: (value: FoldersViewMode) => void;
  className?: string;
}

/**
 * Compact List | Gallery segmented control for Folders chrome.
 * Adapted from pixel-perfect free/premium toggle — Entropy tokens, calm motion.
 */
export function FoldersViewToggle({ value, onChange, className }: FoldersViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Folders view"
      className={cn(
        "relative flex h-6 w-[9.5rem] shrink-0 items-center rounded-full border border-border bg-secondary p-px",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-px w-[calc(50%-1px)] rounded-full bg-select transition-transform duration-150 ease-out"
        style={{
          transform: value === "list" ? "translateX(1px)" : "translateX(calc(100% + 1px))",
        }}
      />
      <button
        type="button"
        className={cn(
          "relative z-10 flex h-full flex-1 items-center justify-center rounded-full px-3 text-[11px] font-medium outline-none transition-colors duration-150",
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
          "relative z-10 flex h-full flex-1 items-center justify-center rounded-full px-3 text-[11px] font-medium outline-none transition-colors duration-150",
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
