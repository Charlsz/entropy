import {
  ChartNetwork,
  Clock,
  Copy,
  Database,
  FilePen,
  FolderOpen,
  GalleryThumbnails,
  Package,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import logoUrl from "../assets/entropy-logo.png";
import { cn } from "../lib/utils";
import { formatBytes } from "../lib/format";
import { osModKey } from "../lib/platform";
import { useWorkspace } from "../state/useWorkspace";
import {
  PERSPECTIVE_LABELS,
  type IntelligenceView,
  type LibraryPerspective,
} from "../types/library";

interface AppSidebarProps {
  onOpenSearch: () => void;
}

export function AppSidebar({ onOpenSearch }: AppSidebarProps) {
  const { workspace, visitSection, updateSettings } = useWorkspace();
  const section = workspace.currentSection;
  const perspective = workspace.settings.libraryPerspective;
  const intelligence = workspace.settings.intelligenceView;
  const [storage, setStorage] = useState<{ free: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!("storage" in navigator) || !navigator.storage?.estimate) return;
        const estimate = await navigator.storage.estimate();
        if (cancelled || !estimate.quota) return;
        const total = estimate.quota;
        const used = estimate.usage ?? 0;
        setStorage({ free: Math.max(0, total - used), total });
      } catch {
        // Optional chrome only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function goNotebook(): void {
    updateSettings({ intelligenceView: null });
    visitSection("notebook");
  }

  function goLibrary(next?: LibraryPerspective): void {
    updateSettings({
      intelligenceView: null,
      ...(next ? { libraryPerspective: next } : {}),
    });
    visitSection("inventory");
  }

  function goIntelligence(view: IntelligenceView): void {
    updateSettings({ intelligenceView: view });
    visitSection("inventory");
  }

  const libraryActive = section === "inventory" && !intelligence;
  const notebookActive = section === "notebook";
  const usedRatio =
    storage && storage.total > 0
      ? Math.min(1, Math.max(0.05, 1 - storage.free / storage.total))
      : 0.55;

  return (
    <aside
      className="relative flex w-[240px] shrink-0 flex-col border-r border-border bg-panel"
      aria-label="Entropy"
    >
      <div className="drag-region flex flex-col gap-3 px-4 pb-3 pt-5">
        <div className="no-drag flex items-center gap-2">
          <img
            src={logoUrl}
            alt=""
            className="size-[18px] object-contain"
            draggable={false}
          />
          <span className="text-sm font-semibold text-foreground">Entropy</span>
        </div>
        <button
          type="button"
          className="no-drag flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left"
          onClick={onOpenSearch}
        >
          <Search className="size-3 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">Search index...</span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {osModKey() === "⌘" ? "⌘K" : "Ctrl+K"}
          </span>
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto pb-24">
        <SectionLabel>Workspace</SectionLabel>
        <SidebarItem
          icon={FilePen}
          label="Notebook"
          active={notebookActive}
          onClick={goNotebook}
        />
        <SidebarItem
          icon={Database}
          label="Library"
          active={libraryActive}
          onClick={() => goLibrary()}
        />

        <SectionLabel>Library Perspectives</SectionLabel>
        {(
          [
            ["folders", FolderOpen],
            ["gallery", GalleryThumbnails],
            ["large-files", Package],
            ["duplicates", Copy],
            ["recent", Clock],
          ] as const
        ).map(([id, icon]) => (
          <SidebarItem
            key={id}
            icon={icon}
            label={PERSPECTIVE_LABELS[id]}
            active={libraryActive && perspective === id}
            onClick={() => goLibrary(id)}
            meta={id === "large-files" ? ">100MB" : undefined}
          />
        ))}

        <SectionLabel>Intelligence</SectionLabel>
        <SidebarItem
          icon={ChartNetwork}
          label="Relationships"
          active={section === "inventory" && intelligence === "relationships"}
          onClick={() => goIntelligence("relationships")}
        />
        <SidebarItem
          icon={Sparkles}
          label="File Copilot"
          active={section === "inventory" && intelligence === "copilot"}
          onClick={() => goIntelligence("copilot")}
        />
      </nav>

      <div className="absolute inset-x-0 bottom-0 border-t border-border bg-panel p-4">
        <div className="mb-2 flex items-start justify-between text-[11px]">
          <span className="text-muted-foreground">Local Storage</span>
          <span className="font-mono text-foreground">
            {storage ? `${formatBytes(storage.free)} free` : "On this device"}
          </span>
        </div>
        <div className="flex h-1 w-full overflow-hidden rounded-sm bg-border">
          <div
            className="h-full rounded-sm bg-accent-bar"
            style={{ width: `${Math.round(usedRatio * 100)}%` }}
          />
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-1.5 pt-4">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{children}</p>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
  meta,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  meta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-[13px]",
        active
          ? "bg-select font-medium text-foreground"
          : "bg-transparent font-normal text-muted-foreground hover:bg-select/60 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta ? <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{meta}</span> : null}
    </button>
  );
}
