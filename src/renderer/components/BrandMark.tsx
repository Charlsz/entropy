export default function BrandMark() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-entropy-border bg-entropy-panel text-entropy-text shadow-subtle">
      <div className="flex h-6 w-6 flex-col justify-center gap-1.5">
        <span className="block h-px w-full bg-current" />
        <span className="block h-px w-4/5 bg-current" />
        <span className="block h-px w-2/3 bg-current" />
      </div>
    </div>
  );
}