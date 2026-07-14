import fs from 'node:fs';
import path from 'node:path';
import { deriveWorkspaceName, type WorkspaceSelection } from '../../shared/workspace';

export function isValidWorkspacePath(workspacePath: string): boolean {
  if (!workspacePath || typeof workspacePath !== 'string') {
    return false;
  }

  try {
    const resolved = path.resolve(workspacePath);
    return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

export function toWorkspaceSelection(workspacePath: string): WorkspaceSelection {
  const resolved = path.resolve(workspacePath);
  return {
    path: resolved,
    name: deriveWorkspaceName(resolved)
  };
}
