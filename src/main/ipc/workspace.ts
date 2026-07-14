import { dialog, ipcMain } from 'electron';
import { app } from 'electron';
import {
  WORKSPACE_CLEAR_LAST_CHANNEL,
  WORKSPACE_GET_LAST_CHANNEL,
  WORKSPACE_PICK_CHANNEL,
  WORKSPACE_SET_LAST_CHANNEL,
  WORKSPACE_VALIDATE_CHANNEL
} from '../../shared/ipc';
import { err, ok, type Result } from '../../shared/result';
import type { WorkspaceAction, WorkspaceSelection } from '../../shared/workspace';
import { getLastWorkspace, setLastWorkspace } from '../services/app-config';
import { isValidWorkspacePath, toWorkspaceSelection } from '../services/workspace';

export function registerWorkspaceIpc(): void {
  ipcMain.handle(
    WORKSPACE_PICK_CHANNEL,
    async (_event, action: WorkspaceAction): Promise<Result<WorkspaceSelection | null>> => {
      try {
        if (action !== 'create' && action !== 'open') {
          return err('Invalid workspace action.');
        }

        const result = dialog.showOpenDialogSync({
          title: action === 'create' ? 'Create Workspace' : 'Open Workspace',
          defaultPath: app.getPath('documents'),
          properties:
            action === 'create'
              ? ['openDirectory', 'createDirectory', 'dontAddToRecent']
              : ['openDirectory', 'dontAddToRecent']
        });

        if (!result || result.length === 0) {
          return ok(null);
        }

        const workspacePath = result[0];
        if (!workspacePath) {
          return ok(null);
        }

        if (!isValidWorkspacePath(workspacePath)) {
          return err('The selected folder could not be opened. It may have been moved or deleted.');
        }

        const workspace = toWorkspaceSelection(workspacePath);
        setLastWorkspace(workspace);
        return ok(workspace);
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to pick a workspace.');
      }
    }
  );

  ipcMain.handle(WORKSPACE_GET_LAST_CHANNEL, async (): Promise<Result<WorkspaceSelection | null>> => {
    try {
      const last = getLastWorkspace();
      if (!last) {
        return ok(null);
      }

      if (!isValidWorkspacePath(last.path)) {
        setLastWorkspace(null);
        return ok(null);
      }

      return ok(toWorkspaceSelection(last.path));
    } catch (error) {
      return err(error instanceof Error ? error.message : 'Failed to load last workspace.');
    }
  });

  ipcMain.handle(
    WORKSPACE_SET_LAST_CHANNEL,
    async (_event, workspace: WorkspaceSelection): Promise<Result<void>> => {
      try {
        if (!workspace?.path || !isValidWorkspacePath(workspace.path)) {
          return err('Cannot remember an invalid workspace path.');
        }

        setLastWorkspace(toWorkspaceSelection(workspace.path));
        return ok(undefined);
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to save last workspace.');
      }
    }
  );

  ipcMain.handle(WORKSPACE_CLEAR_LAST_CHANNEL, async (): Promise<Result<void>> => {
    try {
      setLastWorkspace(null);
      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error.message : 'Failed to clear last workspace.');
    }
  });

  ipcMain.handle(
    WORKSPACE_VALIDATE_CHANNEL,
    async (_event, workspacePath: string): Promise<Result<boolean>> => {
      try {
        return ok(isValidWorkspacePath(workspacePath));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to validate workspace.');
      }
    }
  );
}
