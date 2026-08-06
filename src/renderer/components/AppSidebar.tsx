import { useEffect, useState } from "react";
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
import { cn } from "../lib/utils";
import { formatBytes } from "../lib/format";
import { osModKey } from "../lib/platform";
import { figma } from "../lib/figmaTokens";
import { useWorkspace } from "../state/useWorkspace";
import {
  PERSPECTIVE_LABELS,
  type IntelligenceView,
  type LibraryPerspective,
} from "../types/library";

interface AppSidebarProps {
  onOpenSearch: () => void;
  duplicateCount?: number | null;
}

/** Exact Figma sidebar (240px) — brand, search, nav, storage footer. */
export function AppSidebar({ onOpenSearch, duplicateCount }: AppSidebarProps) {
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
        setStorage({
          free: Math.max(0, estimate.quota - (estimate.usage ?? 0)),
          total: estimate.quota,
        });
      } catch {
        // Optional.
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
      ? Math.min(1, Math.max(0.08, 1 - storage.free / storage.total))
      : 140 / 240;

  return (
    <aside
      className="relative flex h-full w-[240px] shrink-0 flex-col border-r"
      style={{ backgroundColor: figma.surface, borderColor: figma.border }}
      aria-label="Entropy"
    >
      <div className="drag-region flex flex-col gap-3 px-4 pb-3 pt-5">
        <div className="no-drag flex items-center gap-2">
          <span
            className="inline-flex size-[18px] items-center justify-center rounded-full border"
            style={{ borderColor: figma.ink }}
            aria-hidden
          />
          <span className="text-[14px] font-semibold" style={{ color: figma.ink }}>
            Entropy
          </span>
        </div>
        <button
          type="button"
          className="no-drag flex w-full items-center gap-2 rounded-[6px] border px-[10px] py-[6px] text-left"
          style={{ backgroundColor: figma.canvas, borderColor: figma.border }}
          onClick={onOpenSearch}
        >
          <Search className="size-3 shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />
          <span className="min-w-0 flex-1 text-[12px]" style={{ color: figma.muted }}>
            Search index...
          </span>
          <span className="shrink-0 font-mono text-[10px]" style={{ color: figma.muted }}>
            {osModKey() === "⌘" ? "⌘K" : "Ctrl+K"}
          </span>
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto pb-[88px]">
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
            meta={
              id === "large-files"
                ? ">100MB"
                : id === "duplicates" && duplicateCount != null
                  ? String(duplicateCount)
                  : id === "duplicates"
                    ? undefined
                    : undefined
            }
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

      <div
        className="absolute inset-x-0 bottom-0 border-t p-4"
        style={{ backgroundColor: figma.surface, borderColor: figma.border }}
      >
        <div className="mb-2 flex items-start justify-between text-[11px]">
          <span style={{ color: figma.muted }}>Local Storage</span>
          <span className="font-mono" style={{ color: figma.ink }}>
            {storage ? `${formatBytes(storage.free)} free` : "Local disk"}
          </span>
        </div>
        <div
          className="flex h-1 w-full overflow-hidden rounded-[2px]"
          style={{ backgroundColor: figma.border }}
        >
          <div
            className="h-full rounded-[2px]"
            style={{
              backgroundColor: figma.accent,
              width: `${Math.round(usedRatio * 100)}%`,
            }}
          />
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-1.5 pt-4">
      <p
        className="text-[11px] font-semibold uppercase"
        style={{ color: figma.muted }}
      >
        {children}
      </p>
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
        "flex w-full items-center gap-[10px] px-4 py-1.5 text-left text-[13px]",
        active ? "font-medium" : "font-normal",
      )}
      style={{
        backgroundColor: active ? figma.select : "transparent",
        color: active ? figma.ink : figma.muted,
      }}
    >
      <Icon className="size-[14px] shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta ? (
        <span className="shrink-0 font-mono text-[10px]" style={{ color: figma.muted }}>
          {meta}
        </span>
      ) : null}
    </button>
  );
}
