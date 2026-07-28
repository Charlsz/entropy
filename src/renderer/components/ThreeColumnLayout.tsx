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
  className?: string;
}

export function ThreeColumnLayout({
  id,
  sidebar,
  main,
  context = null,
  className,
}: ThreeColumnLayoutProps) {
  const { workspace, updateSettings } = useWorkspace();
  const sidebarRef = usePanelRef();
  const contextRef = usePanelRef();
  const hasContext = context != null;
  const sidebarCollapsed = workspace.settings.sidebarCollapsed;
  const contextCollapsed = workspace.settings.contextCollapsed || !hasContext;

  const defaultLayout = useMemo<Layout>(() => {
    const layout = workspace.settings.panelLayout;
    if (!hasContext) {
      const total = (layout.sidebar + layout.main) || 100;
      return {
        sidebar: (layout.sidebar / total) * 100,
        main: (layout.main / total) * 100,
      } as Layout;
    }
    return {
      sidebar: layout.sidebar,
      main: layout.main,
      context: layout.context,
    };
  }, [hasContext, workspace.settings.panelLayout]);

  useEffect(() => {
    if (sidebarCollapsed) sidebarRef.current?.collapse();
    else sidebarRef.current?.expand();
  }, [sidebarCollapsed, sidebarRef]);

  useEffect(() => {
    if (!hasContext) return;
    if (contextCollapsed) contextRef.current?.collapse();
    else contextRef.current?.expand();
  }, [contextCollapsed, contextRef, hasContext]);

  return (
    <Group
      id={id}
      orientation="horizontal"
      className={cn("h-full min-h-0 w-full", className)}
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout) => {
        updateSettings({ panelLayout: layoutFromGroup(layout, hasContext) });
      }}
    >
      <Panel
        id="sidebar"
        panelRef={sidebarRef}
        className="min-h-0 bg-ink-2"
        minSize="180px"
        collapsible
        collapsedSize={0}
        defaultSize={`${defaultLayout.sidebar}%`}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{sidebar}</div>
      </Panel>

      <Separator className="entropy-resize-handle" />

      <Panel
        id="main"
        className="min-h-0 bg-background"
        minSize="320px"
        defaultSize={`${defaultLayout.main}%`}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{main}</div>
      </Panel>

      {hasContext ? (
        <>
          <Separator className="entropy-resize-handle" />
          <Panel
            id="context"
            panelRef={contextRef}
            className="min-h-0 bg-ink-2"
            minSize="200px"
            collapsible
            collapsedSize={0}
            defaultSize={`${defaultLayout.context}%`}
          >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">{context}</div>
          </Panel>
        </>
      ) : null}
    </Group>
  );
}
