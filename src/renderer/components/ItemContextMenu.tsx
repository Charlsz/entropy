import type { ItemAction } from "./ItemActionsMenu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu";

interface ItemContextMenuProps {
  label: string;
  actions: ItemAction[];
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

/** Right-click menu for Library rows/cards — Entropy surface tokens, no overflow ⋯. */
export function ItemContextMenu({
  label,
  actions,
  children,
  className,
  disabled,
}: ItemContextMenuProps) {
  if (disabled || actions.length === 0) {
    return <>{children}</>;
  }

  const destructive = actions.filter((action) => action.destructive);
  const primary = actions.filter((action) => !action.destructive);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild className={className}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`${label} actions`}>
        {primary.map((action) => (
          <ContextMenuItem
            key={action.label}
            onSelect={(event) => {
              event.preventDefault();
              action.onSelect();
            }}
          >
            {action.label}
          </ContextMenuItem>
        ))}
        {destructive.length > 0 && primary.length > 0 ? <ContextMenuSeparator /> : null}
        {destructive.map((action) => (
          <ContextMenuItem
            key={action.label}
            variant="destructive"
            className="text-muted-foreground data-[highlighted]:text-foreground"
            onSelect={(event) => {
              event.preventDefault();
              action.onSelect();
            }}
          >
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
