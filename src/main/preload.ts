import { contextBridge, ipcRenderer } from 'electron';
import { WORKSPACE_PICK_CHANNEL } from '../shared/ipc';
import type { EntropyApi } from '../shared/api';
import type { WorkspaceAction, WorkspaceSelection } from '../shared/workspace';

const api: EntropyApi = {
  chooseWorkspace(action: WorkspaceAction): Promise<WorkspaceSelection | null> {
    return ipcRenderer.invoke(WORKSPACE_PICK_CHANNEL, action) as Promise<WorkspaceSelection | null>;
  }
};

contextBridge.exposeInMainWorld('entropy', api);