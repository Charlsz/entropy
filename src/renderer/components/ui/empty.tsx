import { cn } from "../../lib/utils";

export function Empty({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-2 px-6 text-center",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-sm font-medium text-paper", className)} {...props} />;
}

export function EmptyDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("max-w-sm text-xs text-paper-2", className)} {...props} />;
}
