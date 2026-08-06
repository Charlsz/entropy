import type { ItemAction } from "./ItemActionsMenu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./ui/context-menu";

interface ItemContextMenuProps {
  label: string;
  actions: ItemAction[];
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

function ActionItems({ actions }: { actions: ItemAction[] }) {
  return (
    <>
      {actions.map((action) => {
        if (action.children && action.children.length > 0) {
          return (
            <ContextMenuSub key={action.label}>
              <ContextMenuSubTrigger>{action.label}</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ActionItems actions={action.children} />
              </ContextMenuSubContent>
            </ContextMenuSub>
          );
        }
        return (
          <ContextMenuItem
            key={action.label}
            variant={action.destructive ? "destructive" : "default"}
            className={
              action.destructive
                ? "text-muted-foreground data-[highlighted]:text-foreground"
                : undefined
            }
            onSelect={(event) => {
              event.preventDefault();
              action.onSelect?.();
            }}
          >
            {action.label}
          </ContextMenuItem>
        );
      })}
    </>
  );
}

/** Right-click menu for list/card rows — Entropy surface tokens, no overflow ⋯. */
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
        <ActionItems actions={primary} />
        {destructive.length > 0 && primary.length > 0 ? <ContextMenuSeparator /> : null}
        <ActionItems actions={destructive} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
