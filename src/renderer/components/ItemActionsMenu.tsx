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
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground outline-none hover:bg-select hover:text-foreground focus-visible:bg-select data-[state=open]:bg-select data-[state=open]:text-foreground"
          aria-label={`${label} actions`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.destructive ? "destructive" : "default"}
            className={
              action.destructive
                ? "text-muted-foreground data-[highlighted]:text-foreground"
                : undefined
            }
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
