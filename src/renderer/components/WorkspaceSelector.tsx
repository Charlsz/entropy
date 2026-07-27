import { useEffect, useState, type MouseEvent } from "react";
import type { RecentWorkspace } from "../../shared/types";

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
      if (selected) {
        onSelect(selected);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(): Promise<void> {
    setBusy(true);
    try {
      const created = await window.entropy.workspace.create();
      if (created) {
        onSelect(created);
      }
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
    <div className="workspace-selector">
      <div className="workspace-panel">
        <div className="workspace-hero">
          <p className="workspace-kicker">Entropy</p>
          <h1>Choose a workspace</h1>
          <p className="workspace-copy">
            A workspace is just a folder on your computer. Entropy never imports or duplicates your
            files.
          </p>
        </div>

        <div className="workspace-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={handleOpen}>
            Open Workspace
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={handleCreate}
          >
            Create Workspace
          </button>
        </div>

        <section className="workspace-recent" aria-label="Recent workspaces">
          <div className="workspace-recent-header">
            <h2>Recent Workspaces</h2>
          </div>

          {loading ? (
            <p className="workspace-empty">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="workspace-empty">No recent workspaces yet.</p>
          ) : (
            <ul className="workspace-list">
              {recent.map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    className="workspace-row"
                    disabled={busy}
                    onClick={() => void handleRecent(item)}
                  >
                    <span className="workspace-row-name">{item.name}</span>
                    <span className="workspace-row-path">{item.path}</span>
                  </button>
                  <button
                    type="button"
                    className="workspace-row-remove"
                    aria-label={`Remove ${item.name} from recent`}
                    onClick={(event) => void handleRemove(event, item)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
