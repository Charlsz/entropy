import { useEffect, useState, type MouseEvent } from "react";
import type { RecentWorkspace } from "../../shared/types";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

interface WorkspaceSelectorProps {
  onSelect: (workspacePath: string) => void;
}

export function WorkspaceSelector({ onSelect }: WorkspaceSelectorProps) {
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
    <div className="flex min-h-0 flex-1 items-center justify-center bg-background p-8">
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Entropy
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Choose a workspace
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            A workspace is just a folder on your computer. Entropy never imports or duplicates your
            files.
          </p>
        </div>

        <div className="flex justify-center gap-2">
          <Button type="button" disabled={busy} onClick={() => void handleOpen()}>
            Open Workspace
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void handleCreate()}
          >
            Create Workspace
          </Button>
        </div>

        <section
          className="overflow-hidden rounded-xl border border-border bg-[hsl(var(--panel))]"
          aria-label="Recent workspaces"
        >
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Recent
            </h2>
          </div>

          <ScrollArea className="max-h-64">
            {loading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No recent workspaces yet.</p>
            ) : (
              <ul className="p-1">
                {recent.map((item) => (
                  <li key={item.path} className="group flex items-center gap-1">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col rounded-lg px-3 py-2.5 text-left hover:bg-accent"
                      disabled={busy}
                      onClick={() => void handleRecent(item)}
                    >
                      <span className="truncate text-sm text-foreground">{item.name}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{item.path}</span>
                    </button>
                    <button
                      type="button"
                      className="mr-1 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"
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
