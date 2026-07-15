import { ipcMain } from 'electron';
import { SEARCH_PAGES_CHANNEL } from '../../shared/ipc';
import { err, ok, type Result } from '../../shared/result';
import type { SearchHit, SearchQuery } from '../../shared/search';
import { searchPages } from '../services/search';

export function registerSearchIpc(): void {
  ipcMain.handle(
    SEARCH_PAGES_CHANNEL,
    async (_event, workspacePath: string, query: SearchQuery): Promise<Result<SearchHit[]>> => {
      try {
        return ok(searchPages(workspacePath, query ?? { query: '' }));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Search failed.');
      }
    }
  );
}
