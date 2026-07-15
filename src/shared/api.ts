import type { FileRef } from './files';
import type { CreatePageInput, Page, PageSummary, WritePageInput } from './pages';
import type { Result } from './result';
import type { SearchHit, SearchQuery } from './search';
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

  pickFile(workspacePath: string): Promise<Result<FileRef | null>>;
  openFile(filePath: string): Promise<Result<void>>;
  resolveFileRef(workspacePath: string, href: string): Promise<Result<FileRef>>;

  searchPages(workspacePath: string, query: SearchQuery): Promise<Result<SearchHit[]>>;
}
