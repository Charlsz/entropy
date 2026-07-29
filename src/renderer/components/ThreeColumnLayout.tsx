import { useEffect, useMemo, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  usePanelRef,
  type Layout,
} from "react-resizable-panels";
import { useWorkspace } from "../state/useWorkspace";
import { layoutFromGroup } from "../state/workspace";
import { cn } from "../lib/utils";

interface ThreeColumnLayoutProps {
  id: string;
  sidebar: ReactNode;
  main: ReactNode;
  context?: ReactNode | null;
  /** Notebook uses editor layout; inventory uses Nav | Content | Treemap. */
  variant?: "notebook" | "inventory";
  /** When false, layout changes are not persisted (inactive keep-alive sections). */
  persistLayout?: boolean;
  className?: string;
}

function syncCollapsed(
  panel: { isCollapsed: () => boolean; collapse: () => void; expand: () => void } | null,
  shouldCollapse: boolean,
): void {
  if (!panel) return;
  try {
    const collapsed = panel.isCollapsed();
    if (shouldCollapse && !collapsed) panel.collapse();
    if (!shouldCollapse && collapsed) panel.expand();
  } catch {
    // Panel group may still be initializing; ignore transient constraint errors.
  }
}

export function ThreeColumnLayout({
  id,
  sidebar,
  main,
  context = null,
  variant = "notebook",
  persistLayout = true,
  className,
}: ThreeColumnLayoutProps) {
  const { workspace, updateSettings } = useWorkspace();
  const sidebarRef = usePanelRef();
  const contextRef = usePanelRef();
  const hasContext = context != null;
  const layoutKey = hasContext ? `${id}-context` : `${id}-main`;
  const sidebarCollapsed = workspace.settings.sidebarCollapsed;
  const contextCollapsed = workspace.settings.contextCollapsed;
  const isInventory = variant === "inventory";
  const savedLayout = isInventory
    ? workspace.settings.inventoryPanelLayout
    : workspace.settings.panelLayout;

  const defaultLayout = useMemo<Layout>(() => {
    if (!hasContext) {
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
  }, [hasContext, savedLayout]);

  useEffect(() => {
    if (!persistLayout) return;
    const frame = window.requestAnimationFrame(() => {
      syncCollapsed(sidebarRef.current, sidebarCollapsed);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sidebarCollapsed, sidebarRef, layoutKey, persistLayout]);

  useEffect(() => {
    if (!persistLayout || !hasContext) return;
    // Inventory treemap should stay visible; do not sync notebook contextCollapsed.
    if (isInventory) return;
    const frame = window.requestAnimationFrame(() => {
      syncCollapsed(contextRef.current, contextCollapsed);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [contextCollapsed, contextRef, hasContext, layoutKey, persistLayout, isInventory]);

  return (
    <Group
      id={layoutKey}
      key={layoutKey}
      orientation="horizontal"
      className={cn("h-full min-h-0 w-full", className)}
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout) => {
        if (!persistLayout) return;
        const next = layoutFromGroup(layout, hasContext, savedLayout);
        if (isInventory) {
          updateSettings({ inventoryPanelLayout: next });
        } else {
          updateSettings({ panelLayout: next });
        }
      }}
    >
      <Panel
        id="sidebar"
        panelRef={sidebarRef}
        className="min-h-0 min-w-0 bg-ink-2"
        minSize="140px"
        maxSize={isInventory ? "32%" : "34%"}
        collapsible
        collapsedSize={0}
        defaultSize={`${defaultLayout.sidebar}%`}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{sidebar}</div>
      </Panel>

      <Separator className="entropy-resize-handle" />

      <Panel
        id="main"
        className="min-h-0 min-w-0 bg-background"
        minSize={isInventory ? "240px" : "420px"}
        defaultSize={`${defaultLayout.main}%`}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{main}</div>
      </Panel>

      {hasContext ? (
        <>
          <Separator className="entropy-resize-handle" />
          <Panel
            id="context"
            panelRef={contextRef}
            className="min-h-0 min-w-0 bg-ink-2"
            minSize={isInventory ? "200px" : "160px"}
            maxSize={isInventory ? "55%" : "30%"}
            collapsible={!isInventory}
            collapsedSize={0}
            defaultSize={`${defaultLayout.context}%`}
          >
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{context}</div>
          </Panel>
        </>
      ) : null}
    </Group>
  );
}
