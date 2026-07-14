import type { Result } from './result';
import type { WorkspaceAction, WorkspaceSelection } from './workspace';

export interface EntropyApi {
  chooseWorkspace(action: WorkspaceAction): Promise<Result<WorkspaceSelection | null>>;
  getLastWorkspace(): Promise<Result<WorkspaceSelection | null>>;
  setLastWorkspace(workspace: WorkspaceSelection): Promise<Result<void>>;
  clearLastWorkspace(): Promise<Result<void>>;
  validateWorkspace(workspacePath: string): Promise<Result<boolean>>;
}
