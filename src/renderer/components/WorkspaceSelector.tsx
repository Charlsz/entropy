import { useEffect, useState, type MouseEvent } from "react";
import type { RecentWorkspace } from "../../shared/types";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Empty, EmptyDescription, EmptyTitle } from "./ui/empty";
import { Skeleton } from "./ui/skeleton";
import { figma } from "../lib/figmaTokens";
import { cn } from "../lib/utils";

interface WorkspaceSelectorProps {
  onSelect: (workspacePath: string) => void;
  /** Compact card for Notebook workspace gate (Figma shell overlay). */
  embedded?: boolean;
}

export function WorkspaceSelector({ onSelect, embedded = false }: WorkspaceSelectorProps) {
  const [recent, setRecent] = useState<RecentWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void window.entropy.workspace.getRecent().then((items) => {
      if (!cancelled) {
        setRecent(items);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleOpen(): Promise<void> {
    setBusy(true);
    try {
      const selected = await window.entropy.workspace.open();
      if (selected) onSelect(selected);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(): Promise<void> {
    setBusy(true);
    try {
      const created = await window.entropy.workspace.create();
      if (created) onSelect(created);
    } finally {
      setBusy(false);
    }
  }

  async function handleRecent(item: RecentWorkspace): Promise<void> {
    setBusy(true);
    try {
      await window.entropy.workspace.remember(item.path);
      onSelect(item.path);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(event: MouseEvent, item: RecentWorkspace): Promise<void> {
    event.stopPropagation();
    await window.entropy.workspace.removeRecent(item.path);
    setRecent((prev) => prev.filter((entry) => entry.path !== item.path));
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 items-center justify-center px-4 py-6",
        !embedded && "h-full",
      )}
      style={{ backgroundColor: embedded ? "transparent" : figma.surface }}
    >
      <div
        className="w-full max-w-md space-y-6 rounded-[8px] border p-8"
        style={{ backgroundColor: figma.canvas, borderColor: figma.border }}
      >
        <div className="space-y-3 text-center">
          <div className="mx-auto flex items-center justify-center gap-2">
            <span
              className="inline-flex size-[18px] items-center justify-center rounded-full border"
              style={{ borderColor: figma.ink }}
              aria-hidden
            />
            <span className="text-[14px] font-semibold" style={{ color: figma.ink }}>
              Entropy
            </span>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: figma.ink }}>
            {embedded ? "Choose a notes workspace" : "Choose a workspace"}
          </h1>
          <p className="mx-auto max-w-sm text-[13px] leading-relaxed" style={{ color: figma.muted }}>
            {embedded
              ? "Notebook stores Markdown in a folder you pick. Library still browses your computer without importing files."
              : "A folder on your computer for notes. Library browses your real files in place — Entropy never imports them."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            disabled={busy}
            className="rounded-[6px]"
            style={{ backgroundColor: figma.ink, color: figma.canvas }}
            onClick={() => void handleOpen()}
          >
            Open Workspace
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="rounded-[6px]"
            style={{
              borderColor: figma.border,
              backgroundColor: figma.surface,
              color: figma.ink,
            }}
            onClick={() => void handleCreate()}
          >
            Create Workspace
          </Button>
        </div>

        <section
          className="overflow-hidden rounded-[6px] border"
          style={{ backgroundColor: figma.surface, borderColor: figma.border }}
          aria-label="Recent workspaces"
        >
          <div className="border-b px-4 py-3" style={{ borderColor: figma.border }}>
            <h2
              className="text-[11px] font-semibold uppercase"
              style={{ color: figma.muted }}
            >
              Recent
            </h2>
          </div>

          <ScrollArea className="max-h-64">
            {loading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recent.length === 0 ? (
              <Empty className="py-8">
                <EmptyTitle>No recent workspaces</EmptyTitle>
                <EmptyDescription>Open or create a folder to get started.</EmptyDescription>
              </Empty>
            ) : (
              <ul>
                {recent.map((item) => (
                  <li
                    key={item.path}
                    className="group flex items-center border-b last:border-b-0"
                    style={{ borderColor: figma.border }}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col px-4 py-2.5 text-left"
                      style={{ color: figma.ink }}
                      disabled={busy}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.backgroundColor = figma.select;
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.backgroundColor = "transparent";
                      }}
                      onClick={() => void handleRecent(item)}
                    >
                      <span className="truncate text-[13px] font-medium">{item.name}</span>
                      <span
                        className="truncate font-mono text-[11px]"
                        style={{ color: figma.muted }}
                      >
                        {item.path}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mr-2 rounded-[6px] px-2 py-1 text-xs opacity-0 group-hover:opacity-100"
                      style={{ color: figma.muted }}
                      aria-label={`Remove ${item.name} from recent`}
                      onClick={(event) => void handleRemove(event, item)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </section>
      </div>
    </div>
  );
}
