import { useState } from "react";
import { Titlebar } from "./components/Titlebar";
import { Sidebar, type SectionId } from "./components/Sidebar";
import { ContentArea } from "./components/ContentArea";
import { WorkspaceSelector } from "./components/WorkspaceSelector";

export function App() {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("notebook");

  if (!workspacePath) {
    return (
      <div className="app-shell">
        <Titlebar />
        <WorkspaceSelector onSelect={setWorkspacePath} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Titlebar workspaceName={workspacePath.split(/[/\\]/).pop() ?? "Workspace"} />
      <div className="app-body">
        <Sidebar active={section} onChange={setSection} />
        <ContentArea section={section} />
      </div>
    </div>
  );
}
