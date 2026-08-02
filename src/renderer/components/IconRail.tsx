import {
  BookOpen,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "../lib/utils";
import type { SectionId } from "../types/section";
import { VISIBLE_SECTIONS } from "../types/section";

const LABELS: Record<SectionId, string> = {
  notebook: "Notebook",
  inventory: "File Inventory",
  canvas: "Canvas",
  settings: "Settings",
};

const ICONS: Record<SectionId, LucideIcon> = {
  notebook: BookOpen,
  inventory: LayoutGrid,
  canvas: LayoutGrid,
  settings: LayoutGrid,
};

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
      {VISIBLE_SECTIONS.map((id) => (
        <RailButton
          key={id}
          label={LABELS[id]}
          active={active === id}
          onClick={() => onChange(id)}
          icon={ICONS[id]}
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
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  const [tipOpen, setTipOpen] = useState(false);

  useEffect(() => {
    if (active) setTipOpen(false);
  }, [active]);

  return (
    <Tooltip open={tipOpen} onOpenChange={setTipOpen}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-current={active ? "page" : undefined}
          onClick={() => {
            setTipOpen(false);
            onClick();
          }}
          onPointerDown={() => setTipOpen(false)}
          className={cn(
            "rounded-md text-muted-foreground",
            active && "bg-ink-2 text-foreground",
          )}
        >
          <Icon strokeWidth={1.75} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
