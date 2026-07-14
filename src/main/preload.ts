import { contextBridge, ipcRenderer } from 'electron';
import type { EntropyApi } from '../shared/api';
import {
  PAGES_CREATE_CHANNEL,
  PAGES_DELETE_CHANNEL,
  PAGES_LIST_CHANNEL,
  PAGES_READ_CHANNEL,
  PAGES_RENAME_CHANNEL,
  PAGES_WRITE_CHANNEL,
  WORKSPACE_CLEAR_LAST_CHANNEL,
  WORKSPACE_GET_LAST_CHANNEL,
  WORKSPACE_PICK_CHANNEL,
  WORKSPACE_SET_LAST_CHANNEL,
  WORKSPACE_VALIDATE_CHANNEL
} from '../shared/ipc';
import type { CreatePageInput, WritePageInput } from '../shared/pages';
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
  },

  listPages(workspacePath: string) {
    return ipcRenderer.invoke(PAGES_LIST_CHANNEL, workspacePath);
  },
  createPage(workspacePath: string, input?: CreatePageInput) {
    return ipcRenderer.invoke(PAGES_CREATE_CHANNEL, workspacePath, input);
  },
  readPage(workspacePath: string, pageId: string) {
    return ipcRenderer.invoke(PAGES_READ_CHANNEL, workspacePath, pageId);
  },
  writePage(workspacePath: string, pageId: string, input: WritePageInput) {
    return ipcRenderer.invoke(PAGES_WRITE_CHANNEL, workspacePath, pageId, input);
  },
  renamePage(workspacePath: string, pageId: string, title: string) {
    return ipcRenderer.invoke(PAGES_RENAME_CHANNEL, workspacePath, pageId, title);
  },
  deletePage(workspacePath: string, pageId: string) {
    return ipcRenderer.invoke(PAGES_DELETE_CHANNEL, workspacePath, pageId);
  }
};

contextBridge.exposeInMainWorld('entropy', api);
