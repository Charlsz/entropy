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
  sidebar = null,
  main,
  context = null,
  variant = "notebook",
  persistLayout = true,
  className,
}: ThreeColumnLayoutProps) {
  const { workspace, updateSettings } = useWorkspace();
  const sidebarRef = usePanelRef();
  const contextRef = usePanelRef();
  const hasSidebar = sidebar != null;
  const hasContext = context != null;
  const layoutKey = `${id}-${hasSidebar ? "side" : "noside"}-${hasContext ? "context" : "main"}`;
  const sidebarCollapsed = workspace.settings.sidebarCollapsed;
  const contextCollapsed = workspace.settings.contextCollapsed;
  const isInventory = variant === "inventory";
  const savedLayout = isInventory
    ? workspace.settings.inventoryPanelLayout
    : workspace.settings.panelLayout;

  const defaultLayout = useMemo<Layout>(() => {
    if (!hasSidebar && hasContext) {
      const total = (savedLayout.main + savedLayout.context) || 100;
      return {
        main: (savedLayout.main / total) * 100,
        context: (savedLayout.context / total) * 100,
      } as Layout;
    }
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
  }, [hasContext, hasSidebar, savedLayout]);

  useEffect(() => {
    if (!persistLayout || !hasSidebar) return;
    const frame = window.requestAnimationFrame(() => {
      syncCollapsed(sidebarRef.current, sidebarCollapsed);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sidebarCollapsed, sidebarRef, layoutKey, persistLayout, hasSidebar]);

  useEffect(() => {
    if (!persistLayout || !hasContext) return;
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
        if (!hasSidebar && hasContext) {
          const next = {
            sidebar: 0,
            main: layout.main ?? savedLayout.main,
            context: layout.context ?? savedLayout.context,
          };
          if (isInventory) updateSettings({ inventoryPanelLayout: next });
          else updateSettings({ panelLayout: next });
          return;
        }
        const next = layoutFromGroup(layout, hasContext, savedLayout);
        if (isInventory) updateSettings({ inventoryPanelLayout: next });
        else updateSettings({ panelLayout: next });
      }}
    >
      {hasSidebar ? (
        <>
          <Panel
            id="sidebar"
            panelRef={sidebarRef}
            className="min-h-0 min-w-0 bg-ink-2"
            minSize={isInventory ? "10%" : "140px"}
            maxSize={isInventory ? "22%" : "34%"}
            collapsible
            collapsedSize={0}
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
        minSize={isInventory ? "18%" : "28%"}
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
            minSize={isInventory ? "22%" : "14%"}
            maxSize={isInventory ? "72%" : "36%"}
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
