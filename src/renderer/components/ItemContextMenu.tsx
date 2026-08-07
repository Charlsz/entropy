import { useEffect, useState } from "react";
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
  /** When this changes (section switch, etc.), dismiss any open menu. */
  dismissKey?: string | number | null;
}

function ActionItems({
  actions,
  onNavigate,
}: {
  actions: ItemAction[];
  onNavigate: () => void;
}) {
  return (
    <>
      {actions.map((action) => {
        if (action.children && action.children.length > 0) {
          return (
            <ContextMenuSub key={action.label}>
              <ContextMenuSubTrigger>{action.label}</ContextMenuSubTrigger>
              <ContextMenuSubContent sideOffset={6} alignOffset={-2}>
                <ActionItems actions={action.children} onNavigate={onNavigate} />
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
            onSelect={() => {
              // Do not preventDefault — Radix needs the default to close the menu.
              onNavigate();
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
  dismissKey,
}: ItemContextMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [dismissKey]);

  if (disabled || actions.length === 0) {
    return <>{children}</>;
  }

  const destructive = actions.filter((action) => action.destructive);
  const primary = actions.filter((action) => !action.destructive);

  return (
    <ContextMenu open={open} onOpenChange={setOpen}>
      <ContextMenuTrigger asChild className={className}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`${label} actions`}>
        <ActionItems actions={primary} onNavigate={() => setOpen(false)} />
        {destructive.length > 0 && primary.length > 0 ? <ContextMenuSeparator /> : null}
        <ActionItems actions={destructive} onNavigate={() => setOpen(false)} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
