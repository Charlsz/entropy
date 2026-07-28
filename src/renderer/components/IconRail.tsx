import {
  BookOpen,
  Files,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "../lib/utils";
import type { SectionId } from "../types/section";

const ITEMS: { id: SectionId; label: string; icon: LucideIcon; shortcut?: string }[] = [
  { id: "notebook", label: "Notebook", icon: BookOpen, shortcut: "⌘1" },
  { id: "files", label: "Files", icon: Files, shortcut: "⌘2" },
  { id: "canvas", label: "Canvas", icon: LayoutDashboard, shortcut: "⌘3" },
];

interface IconRailProps {
  active: SectionId;
  onChange: (section: SectionId) => void;
}

export function IconRail({ active, onChange }: IconRailProps) {
  return (
    <aside
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-ink py-2"
      aria-label="Primary navigation"
    >
      {ITEMS.map((item) => (
        <RailButton
          key={item.id}
          label={item.label}
          shortcut={item.shortcut}
          active={active === item.id}
          onClick={() => onChange(item.id)}
          icon={item.icon}
        />
      ))}
    </aside>
  );
}

function RailButton({
  label,
  icon: Icon,
  active,
  onClick,
  shortcut,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-current={active ? "page" : undefined}
          onClick={onClick}
          className={cn(
            "rounded-md text-muted-foreground",
            active && "bg-ink-2 text-paper",
          )}
        >
          <Icon strokeWidth={1.75} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {label}
        {shortcut ? <span className="ml-2 opacity-60">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
