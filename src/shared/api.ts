import type { CreatePageInput, Page, PageSummary, WritePageInput } from './pages';
import type { Result } from './result';
import type { WorkspaceAction, WorkspaceSelection } from './workspace';

export interface EntropyApi {
  chooseWorkspace(action: WorkspaceAction): Promise<Result<WorkspaceSelection | null>>;
  getLastWorkspace(): Promise<Result<WorkspaceSelection | null>>;
  setLastWorkspace(workspace: WorkspaceSelection): Promise<Result<void>>;
  clearLastWorkspace(): Promise<Result<void>>;
  validateWorkspace(workspacePath: string): Promise<Result<boolean>>;

  listPages(workspacePath: string): Promise<Result<PageSummary[]>>;
  createPage(workspacePath: string, input?: CreatePageInput): Promise<Result<Page>>;
  readPage(workspacePath: string, pageId: string): Promise<Result<Page>>;
  writePage(workspacePath: string, pageId: string, input: WritePageInput): Promise<Result<Page>>;
  renamePage(workspacePath: string, pageId: string, title: string): Promise<Result<Page>>;
  deletePage(workspacePath: string, pageId: string): Promise<Result<void>>;
}
