import { useEffect, useState } from "react";
import {
  Copy,
  Database,
  FilePen,
  FolderOpen,
  GalleryThumbnails,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";
import searchIcon from "../assets/icons/search.svg";
import logoDark from "../assets/entropy_dark.png";
import logoLight from "../assets/entropy-logo.png";
import { cn } from "../lib/utils";
import { formatBytes } from "../lib/format";
import { osModKey } from "../lib/platform";
import { figma } from "../lib/figmaTokens";
import {
  getLargeFilesCache,
  subscribeLargeFilesCache,
} from "../lib/largeFilesCache";
import { useWorkspace } from "../state/useWorkspace";
import {
  PERSPECTIVE_LABELS,
  type LibraryPerspective,
} from "../types/library";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface AppSidebarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchFocus: () => void;
  duplicateCount?: number | null;
}

function storageFillColor(occupiedRatio: number): string {
  if (occupiedRatio >= 0.9) return "var(--color-ink)";
  if (occupiedRatio >= 0.75) return "color-mix(in srgb, var(--color-ink) 72%, var(--color-accent))";
  if (occupiedRatio >= 0.5) return "var(--color-accent)";
  return "color-mix(in srgb, var(--color-accent) 70%, var(--color-muted))";
}

function readLargeFilesBytesFromCache(): number | null {
  const cached = getLargeFilesCache();
  return cached?.result.totalBytes ?? null;
}

/** Shared app sidebar — brand, search, nav, storage footer. */
export function AppSidebar({
  searchQuery,
  onSearchQueryChange,
  onSearchFocus,
  duplicateCount,
}: AppSidebarProps) {
  const { workspace, visitSection, updateSettings, goToFolder } = useWorkspace();
  const section = workspace.currentSection;
  const perspective = workspace.settings.libraryPerspective;
  const settingsLargeFilesBytes = workspace.settings.largeFilesApproxBytes;
  const theme = workspace.settings.theme;
  const [storage, setStorage] = useState<{ free: number; total: number } | null>(null);
  const [cacheLargeFilesBytes, setCacheLargeFilesBytes] = useState<number | null>(
    readLargeFilesBytesFromCache,
  );

  const largeFilesBytes = cacheLargeFilesBytes ?? settingsLargeFilesBytes;

  useEffect(() => {
    function syncCache(): void {
      setCacheLargeFilesBytes(readLargeFilesBytesFromCache());
    }
    syncCache();
    return subscribeLargeFilesCache(syncCache);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const info = await window.entropy.fs.getDiskSpace();
        if (cancelled || !info.total) return;
        setStorage({ free: info.free, total: info.total });
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
    if (next === "gallery") {
      void window.entropy.fs.getHomePath().then((home) => {
        goToFolder(home);
      });
    }
  }

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>): void {
    onSearchQueryChange(event.target.value);
    onSearchFocus();
  }

  const libraryActive = section === "inventory";
  const notebookActive = section === "notebook";
  const occupiedRatio =
    storage && storage.total > 0
      ? Math.min(1, Math.max(0, (storage.total - storage.free) / storage.total))
      : 0;
  const isMac = window.entropy.platform === "darwin";
  const logoSrc = theme === "dark" ? logoLight : logoDark;
  const searchShortcut = osModKey() === "⌘" ? "⌘K" : "Ctrl+K";

  return (
    <aside
      className="relative flex h-full w-[240px] shrink-0 flex-col border-r"
      style={{ backgroundColor: figma.surface, borderColor: figma.border }}
      aria-label="Entropy"
    >
      <div
        className="drag-region flex flex-col gap-3 px-4 pb-3"
        style={{ paddingTop: isMac ? 40 : 20 }}
      >
        <div className="no-drag flex h-[18px] items-center justify-between">
          <img
            src={logoSrc}
            alt=""
            width={18}
            height={18}
            className="size-[18px] object-contain"
            aria-hidden
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-[18px] items-center justify-center"
                style={{ color: figma.muted }}
                aria-label="Settings"
                onClick={() => visitSection("settings")}
              >
                <Settings className="size-[14px]" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings</TooltipContent>
          </Tooltip>
        </div>
        <label
          className="no-drag flex w-full items-center gap-2 rounded-[6px] border px-[10px] py-[7px]"
          style={{ backgroundColor: figma.canvas, borderColor: figma.border }}
        >
          <span className="relative size-3.5 shrink-0 overflow-hidden opacity-70" aria-hidden>
            <img src={searchIcon} alt="" className="absolute inset-0 size-full" width={14} height={14} />
          </span>
          <input
            type="search"
            data-entropy-search
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={onSearchFocus}
            placeholder="Search index…"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            className="entropy-search-input min-w-0 flex-1 bg-transparent text-[13px] leading-snug outline-none placeholder:text-[13px]"
            style={{ color: figma.ink }}
            aria-label="Search index"
          />
          {searchQuery ? (
            <button
              type="button"
              className="shrink-0 text-[11px] leading-none"
              style={{ color: figma.muted }}
              aria-label="Clear search"
              onClick={() => onSearchQueryChange("")}
            >
              Clear
            </button>
          ) : (
            <span className="shrink-0 font-mono text-[10px] tracking-wide" style={{ color: figma.muted }}>
              {searchShortcut}
            </span>
          )}
        </label>
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
                ? largeFilesBytes != null && largeFilesBytes > 0
                  ? `~${formatBytes(largeFilesBytes)}`
                  : undefined
                : id === "duplicates" && duplicateCount != null
                  ? String(duplicateCount)
                  : undefined
            }
          />
        ))}
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
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(occupiedRatio * 100)}
          aria-label="Disk space used"
        >
          <div
            className="h-full rounded-[2px]"
            style={{
              backgroundColor: storageFillColor(occupiedRatio),
              width: `${Math.round(occupiedRatio * 100)}%`,
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
      <p className="text-[11px] font-semibold uppercase" style={{ color: figma.muted }}>
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
