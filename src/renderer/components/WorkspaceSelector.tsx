import { useEffect, useState, type MouseEvent } from "react";
import type { RecentWorkspace } from "../../shared/types";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Empty, EmptyDescription, EmptyTitle } from "./ui/empty";
import { Skeleton } from "./ui/skeleton";
import logoUrl from "../assets/entropy-logo.png";

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
    <div className="flex min-h-0 flex-1 items-center justify-center bg-panel px-4 py-6 sm:p-8">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-background p-8 shadow-none">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex items-center justify-center gap-2">
            <img
              src={logoUrl}
              alt=""
              className="h-[18px] w-[18px] object-contain"
              draggable={false}
            />
            <span className="text-sm font-semibold text-foreground">Entropy</span>
          </div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
            Choose a workspace
          </h1>
          <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            A folder on your computer for notes and settings. Library still browses your real files
            in place — Entropy never imports them.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            className="bg-foreground text-background hover:bg-foreground/90"
            disabled={busy}
            onClick={() => void handleOpen()}
          >
            Open Workspace
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-border bg-panel text-foreground"
            disabled={busy}
            onClick={() => void handleCreate()}
          >
            Create Workspace
          </Button>
        </div>

        <section
          className="overflow-hidden rounded-md border border-border bg-panel"
          aria-label="Recent workspaces"
        >
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[11px] font-semibold uppercase text-muted-foreground">Recent</h2>
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
                    className="group flex items-center border-b border-border last:border-b-0"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col px-4 py-2.5 text-left hover:bg-select"
                      disabled={busy}
                      onClick={() => void handleRecent(item)}
                    >
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        {item.path}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mr-2 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 hover:bg-select hover:text-foreground group-hover:opacity-100"
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
