interface StatusBarProps {
  left?: string;
  right?: string;
}

export function StatusBar({ left, right }: StatusBarProps) {
  if (!left && !right) return null;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-ink px-3 text-[11px] text-muted-foreground">
      <span className="min-w-0 flex-1 truncate" title={left}>
        {left}
      </span>
      {right ? (
        <span className="min-w-0 max-w-[48%] shrink truncate text-right" title={right}>
          {right}
        </span>
      ) : null}
    </footer>
  );
}
