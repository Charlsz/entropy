import { useMemo, type ReactNode } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";
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
  const savedLayout = isInventory
    ? workspace.settings.inventoryPanelLayout
    : clampNotebookPanelLayout(workspace.settings.panelLayout);

  // Percentages only for defaults — pixel min/max keep sides from crushing the editor.
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

  // Bump when constraint model changes so crushed saved layouts remount cleanly.
  const layoutKey = `${id}-v2-${hasSidebar ? "side" : "noside"}-${hasContext ? "context" : "main"}`;

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
          if (isInventory) {
            updateSettings({ inventoryPanelLayout: next });
          } else {
            const context = Math.min(30, Math.max(18, next.context));
            const main = 100 - context;
            updateSettings({ panelLayout: { sidebar: 0, main, context } });
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

      {hasContext ? (
        <>
          <Separator className="entropy-resize-handle" />
          <Panel
            id="context"
            className={cn("min-h-0 bg-ink-2", isInventory ? "min-w-0" : "min-w-[15rem]")}
            minSize={isInventory ? "16%" : 240}
            maxSize={isInventory ? "55%" : 360}
            defaultSize={`${defaultLayout.context}%`}
          >
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{context}</div>
          </Panel>
        </>
      ) : null}
    </Group>
  );
}
