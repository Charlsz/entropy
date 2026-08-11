import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  type Layout,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { useWorkspace } from "../state/useWorkspace";
import { clampNotebookPanelLayout, layoutFromGroup } from "../state/workspace";
import { cn } from "../lib/utils";

interface ThreeColumnLayoutProps {
  id: string;
  /** Pass null to hide the left column (Inventory Content | Treemap). */
  sidebar?: ReactNode | null;
  main: ReactNode;
  context?: ReactNode | null;
  /** Notebook uses editor layout; inventory uses Content | Treemap. */
  variant?: "notebook" | "inventory";
  /** When false, layout changes are not persisted (inactive keep-alive sections). */
  persistLayout?: boolean;
  className?: string;
}

export function ThreeColumnLayout({
  id,
  sidebar = null,
  main,
  context = null,
  variant = "notebook",
  persistLayout = true,
  className,
}: ThreeColumnLayoutProps) {
  const { workspace, updateSettings } = useWorkspace();
  const hasSidebar = sidebar != null;
  const hasContext = context != null;
  const isInventory = variant === "inventory";
  /** Notebook keeps a zero-width context slot so the notes column does not resize. */
  const keepContextSlot = !isInventory && hasSidebar;
  const showContext = hasContext;
  const contextPanelRef = useRef<PanelImperativeHandle>(null);
  const savedLayout = isInventory
    ? workspace.settings.inventoryPanelLayout
    : clampNotebookPanelLayout(workspace.settings.panelLayout);

  const defaultLayout = useMemo<Layout>(() => {
    if (keepContextSlot) {
      // Always reserve the saved context share; collapse/expand via imperative API.
      return {
        sidebar: savedLayout.sidebar,
        main: savedLayout.main,
        context: savedLayout.context,
      } as Layout;
    }
    if (!hasSidebar && hasContext) {
      const total = (savedLayout.main + savedLayout.context) || 100;
      return {
        main: (savedLayout.main / total) * 100,
        context: (savedLayout.context / total) * 100,
      } as Layout;
    }
    if (!hasContext) {
      // Inventory / legacy: keep saved sidebar as share of (sidebar+main) only.
      const total = (savedLayout.sidebar + savedLayout.main) || 100;
      return {
        sidebar: (savedLayout.sidebar / total) * 100,
        main: (savedLayout.main / total) * 100,
      } as Layout;
    }
    const total =
      (savedLayout.sidebar + savedLayout.main + savedLayout.context) || 100;
    return {
      sidebar: (savedLayout.sidebar / total) * 100,
      main: (savedLayout.main / total) * 100,
      context: (savedLayout.context / total) * 100,
    };
  }, [hasContext, hasSidebar, keepContextSlot, savedLayout]);

  // Stable key — remounting on showContext made note↔image switches flash the whole UI.
  const layoutKey = keepContextSlot
    ? `${id}-v4-notebook`
    : `${id}-v4-${hasSidebar ? "side" : "noside"}-${hasContext ? "context" : "main"}`;

  // Before paint. expand() alone restores the *last* size — if the panel never
  // opened (always 0), it stays invisible; resize to the saved share.
  useLayoutEffect(() => {
    if (!keepContextSlot) return;
    const panel = contextPanelRef.current;
    if (!panel) return;
    if (showContext) {
      if (panel.isCollapsed()) panel.expand();
      const { asPercentage } = panel.getSize();
      if (asPercentage < 8) {
        panel.resize(`${savedLayout.context}%`);
      }
    } else if (!panel.isCollapsed()) {
      panel.collapse();
    }
  }, [keepContextSlot, savedLayout.context, showContext]);

  return (
    <Group
      id={layoutKey}
      key={layoutKey}
      orientation="horizontal"
      className={cn("h-full min-h-0 w-full", className)}
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout) => {
        if (!persistLayout) return;
        if (keepContextSlot) {
          const sidebar = layout.sidebar ?? savedLayout.sidebar;
          const contextSize = showContext
            ? (layout.context ?? savedLayout.context)
            : savedLayout.context;
          const main = showContext
            ? (layout.main ?? savedLayout.main)
            : Math.max(0, (layout.main ?? 100 - sidebar) - contextSize);
          updateSettings({
            panelLayout: clampNotebookPanelLayout({
              sidebar,
              main,
              context: contextSize,
            }),
          });
          return;
        }
        if (!hasSidebar && hasContext) {
          const next = {
            sidebar: 0,
            main: layout.main ?? savedLayout.main,
            context: layout.context ?? savedLayout.context,
          };
          if (isInventory) {
            updateSettings({ inventoryPanelLayout: next });
          } else {
            const contextPct = Math.min(30, Math.max(18, next.context));
            const mainPct = 100 - contextPct;
            updateSettings({ panelLayout: { sidebar: 0, main: mainPct, context: contextPct } });
          }
          return;
        }
        const next = layoutFromGroup(layout, hasContext, savedLayout);
        if (isInventory) updateSettings({ inventoryPanelLayout: next });
        else updateSettings({ panelLayout: clampNotebookPanelLayout(next) });
      }}
    >
      {hasSidebar ? (
        <>
          <Panel
            id="sidebar"
            className={cn("min-h-0 bg-ink-2", isInventory ? "min-w-0" : "min-w-[13.75rem]")}
            minSize={isInventory ? "14%" : 220}
            maxSize={isInventory ? "28%" : 320}
            defaultSize={`${defaultLayout.sidebar}%`}
          >
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{sidebar}</div>
          </Panel>
          <Separator className="entropy-resize-handle" />
        </>
      ) : null}

      <Panel
        id="main"
        className="min-h-0 min-w-0 bg-background"
        minSize={isInventory ? "32%" : 400}
        defaultSize={`${defaultLayout.main}%`}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{main}</div>
      </Panel>

      {keepContextSlot || hasContext ? (
        <>
          <Separator
            className={cn(
              "entropy-resize-handle",
              keepContextSlot && !showContext && "pointer-events-none opacity-0",
            )}
            disabled={keepContextSlot && !showContext}
          />
          <Panel
            id="context"
            panelRef={contextPanelRef}
            className={cn(
              "min-h-0 bg-panel",
              isInventory ? "min-w-0" : showContext ? "min-w-[15rem]" : "min-w-0",
              keepContextSlot && !showContext && "overflow-hidden",
            )}
            minSize={
              keepContextSlot
                ? showContext
                  ? 240
                  : 0
                : isInventory
                  ? "16%"
                  : 240
            }
            // Keep a real max while collapsed — maxSize 0 blocked expand/resize.
            maxSize={keepContextSlot ? 360 : isInventory ? "55%" : 360}
            collapsible={keepContextSlot}
            collapsedSize={0}
            defaultSize={
              keepContextSlot
                ? showContext
                  ? `${defaultLayout.context}%`
                  : 0
                : `${defaultLayout.context}%`
            }
          >
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
              {showContext ? context : null}
            </div>
          </Panel>
        </>
      ) : null}
    </Group>
  );
}
