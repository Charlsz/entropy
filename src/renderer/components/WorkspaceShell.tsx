import { Titlebar } from "../components/Titlebar";
import { Sidebar } from "../components/Sidebar";
import { ContentArea } from "../components/ContentArea";
import { useWorkspace } from "../state/WorkspaceContext";

export function WorkspaceShell() {
  const { workspace, setSection, closeWorkspace } = useWorkspace();

  return (
    <div className="app-shell">
      <Titlebar workspaceName={workspace.name} onCloseWorkspace={closeWorkspace} />
      <div className="app-body">
        <Sidebar active={workspace.currentSection} onChange={setSection} />
        <ContentArea section={workspace.currentSection} />
      </div>
    </div>
  );
}
