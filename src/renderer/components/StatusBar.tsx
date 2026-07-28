interface StatusBarProps {
  left?: string;
  right?: string;
}

export function StatusBar({ left, right }: StatusBarProps) {
  if (!left && !right) return null;

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-ink px-3 text-[11px] text-muted-foreground">
      <span className="truncate">{left}</span>
      <span className="shrink-0">{right}</span>
    </footer>
  );
}
