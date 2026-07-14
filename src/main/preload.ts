import { contextBridge, ipcRenderer } from 'electron';
import type { EntropyApi } from '../shared/api';
import {
  WORKSPACE_CLEAR_LAST_CHANNEL,
  WORKSPACE_GET_LAST_CHANNEL,
  WORKSPACE_PICK_CHANNEL,
  WORKSPACE_SET_LAST_CHANNEL,
  WORKSPACE_VALIDATE_CHANNEL
} from '../shared/ipc';
import type { WorkspaceAction, WorkspaceSelection } from '../shared/workspace';

const api: EntropyApi = {
  chooseWorkspace(action: WorkspaceAction) {
    return ipcRenderer.invoke(WORKSPACE_PICK_CHANNEL, action);
  },
  getLastWorkspace() {
    return ipcRenderer.invoke(WORKSPACE_GET_LAST_CHANNEL);
  },
  setLastWorkspace(workspace: WorkspaceSelection) {
    return ipcRenderer.invoke(WORKSPACE_SET_LAST_CHANNEL, workspace);
  },
  clearLastWorkspace() {
    return ipcRenderer.invoke(WORKSPACE_CLEAR_LAST_CHANNEL);
  },
  validateWorkspace(workspacePath: string) {
    return ipcRenderer.invoke(WORKSPACE_VALIDATE_CHANNEL, workspacePath);
  }
};

contextBridge.exposeInMainWorld('entropy', api);
