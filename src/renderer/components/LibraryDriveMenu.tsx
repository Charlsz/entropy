import { useState } from "react";
import { ChevronDown, FolderPlus, HardDrive } from "lucide-react";
import type { InventoryRoot } from "../../shared/types";
import { useWorkspace } from "../state/useWorkspace";
import { figma } from "../lib/figmaTokens";
import { samePath } from "../lib/platform";
import { shouldPinLibraryRoot } from "../lib/libraryRoots";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/**
 * Choose where Library looks: Home and known places, or another attached drive.
 * Opening a drive lists that drive only. It does not scan every volume.
 */
export function LibraryDriveMenu({ label }: { label: string }) {
  const { workspace, goToFolder, updateSettings } = useWorkspace();
  const [places, setPlaces] = useState<InventoryRoot[]>([]);
  const [drives, setDrives] = useState<InventoryRoot[]>([]);
  const current = workspace.inventoryScanRoot;

  async function refreshChoices(): Promise<void> {
    const [nextPlaces, nextDrives] = await Promise.all([
      window.entropy.fs.getInventoryRoots(workspace.settings.inventoryExtraRoots),
      window.entropy.fs.listMountRoots(),
    ]);
    setPlaces(nextPlaces);
    const placePaths = new Set(nextPlaces.map((place) => place.path.toLowerCase()));
    setDrives(
      nextDrives
        .filter((drive) => !placePaths.has(drive.path.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  function openRoot(root: InventoryRoot): void {
    updateSettings({
      libraryRootPath: shouldPinLibraryRoot(root) ? root.path : null,
    });
    goToFolder(root.path, "push", { activate: true });
  }

  async function addFolder(): Promise<void> {
    const picked = await window.entropy.fs.pickInventoryFolder();
    if (!picked) return;
    const extra = workspace.settings.inventoryExtraRoots;
    const already = extra.some((item) => samePath(item, picked));
    updateSettings({
      inventoryExtraRoots: already ? extra : [...extra, picked],
      libraryRootPath: picked,
    });
    goToFolder(picked, "push", { activate: true });
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refreshChoices();
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="no-drag inline-flex min-w-0 max-w-[12rem] items-center gap-1 text-[13px] font-medium"
          style={{ color: figma.ink }}
          aria-label="Choose drive or folder"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 shrink-0" style={{ color: figma.muted }} strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <MenuLabel>Places</MenuLabel>
        {places.map((place) => (
          <DropdownMenuItem key={place.id} onSelect={() => openRoot(place)}>
            <Choice label={place.name} active={samePath(place.path, current)} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <MenuLabel>Drives</MenuLabel>
        {drives.length === 0 ? (
          <DropdownMenuItem disabled>
            <span style={{ color: figma.muted }}>No other drives</span>
          </DropdownMenuItem>
        ) : (
          drives.map((drive) => (
            <DropdownMenuItem key={drive.id} onSelect={() => openRoot(drive)}>
              <Choice
                label={drive.name}
                detail={drive.path}
                active={samePath(drive.path, current)}
                icon
              />
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void addFolder()}>
          <span className="inline-flex items-center gap-2">
            <FolderPlus className="size-3.5" strokeWidth={1.75} />
            Add folder
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuLabel({ children }: { children: string }) {
  return (
    <div className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase" style={{ color: figma.muted }}>
      {children}
    </div>
  );
}

function Choice({
  label,
  detail,
  active,
  icon,
}: {
  label: string;
  detail?: string;
  active: boolean;
  icon?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {icon ? <HardDrive className="size-3.5 shrink-0" strokeWidth={1.75} /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail ? (
        <span className="shrink-0 font-mono text-[10px]" style={{ color: figma.muted }}>
          {detail}
        </span>
      ) : null}
      {active ? (
        <span className="shrink-0 text-[10px]" style={{ color: figma.accent }}>
          Current
        </span>
      ) : null}
    </span>
  );
}
