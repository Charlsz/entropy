import type { WorkspaceAction, WorkspaceSelection } from './workspace';

export interface EntropyApi {
  chooseWorkspace(action: WorkspaceAction): Promise<WorkspaceSelection | null>;
}