import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export interface ItemAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

interface ItemActionsMenuProps {
  label: string;
  actions: ItemAction[];
}

export function ItemActionsMenu({ label, actions }: ItemActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          aria-label={`${label} actions`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.destructive ? "destructive" : "default"}
            onSelect={(event) => {
              event.preventDefault();
              action.onSelect();
            }}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
