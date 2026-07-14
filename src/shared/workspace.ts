export type WorkspaceAction = 'create' | 'open';

export interface WorkspaceSelection {
  name: string;
  path: string;
}

export function deriveWorkspaceName(workspacePath: string): string {
  const normalized = workspacePath.replace(/[\\/]+$/, '');
  if (!normalized) {
    return 'Workspace';
  }

  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}