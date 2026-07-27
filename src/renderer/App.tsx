import { useCallback, useState } from "react";
import { Titlebar } from "./components/Titlebar";
import { WorkspaceSelector } from "./components/WorkspaceSelector";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { WorkspaceProvider } from "./state/WorkspaceContext";

export function App() {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);

  const closeWorkspace = useCallback(() => {
    setWorkspacePath(null);
  }, []);

  if (!workspacePath) {
    return (
      <div className="app-shell">
        <Titlebar />
        <WorkspaceSelector onSelect={setWorkspacePath} />
      </div>
    );
  }

  return (
    <WorkspaceProvider key={workspacePath} path={workspacePath} onClose={closeWorkspace}>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}
