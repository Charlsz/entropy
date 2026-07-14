import { ipcMain } from 'electron';
import {
  PAGES_CREATE_CHANNEL,
  PAGES_DELETE_CHANNEL,
  PAGES_LIST_CHANNEL,
  PAGES_READ_CHANNEL,
  PAGES_RENAME_CHANNEL,
  PAGES_WRITE_CHANNEL
} from '../../shared/ipc';
import type { CreatePageInput, WritePageInput } from '../../shared/pages';
import { err, ok, type Result } from '../../shared/result';
import type { Page, PageSummary } from '../../shared/pages';
import * as pagesService from '../services/pages';

export function registerPagesIpc(): void {
  ipcMain.handle(
    PAGES_LIST_CHANNEL,
    async (_event, workspacePath: string): Promise<Result<PageSummary[]>> => {
      try {
        return ok(pagesService.listPages(workspacePath));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to list pages.');
      }
    }
  );

  ipcMain.handle(
    PAGES_CREATE_CHANNEL,
    async (_event, workspacePath: string, input?: CreatePageInput): Promise<Result<Page>> => {
      try {
        return ok(pagesService.createPage(workspacePath, input));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to create page.');
      }
    }
  );

  ipcMain.handle(
    PAGES_READ_CHANNEL,
    async (_event, workspacePath: string, pageId: string): Promise<Result<Page>> => {
      try {
        return ok(pagesService.readPage(workspacePath, pageId));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to read page.');
      }
    }
  );

  ipcMain.handle(
    PAGES_WRITE_CHANNEL,
    async (
      _event,
      workspacePath: string,
      pageId: string,
      input: WritePageInput
    ): Promise<Result<Page>> => {
      try {
        return ok(pagesService.writePage(workspacePath, pageId, input));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to save page.');
      }
    }
  );

  ipcMain.handle(
    PAGES_RENAME_CHANNEL,
    async (_event, workspacePath: string, pageId: string, title: string): Promise<Result<Page>> => {
      try {
        return ok(pagesService.renamePage(workspacePath, pageId, title));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to rename page.');
      }
    }
  );

  ipcMain.handle(
    PAGES_DELETE_CHANNEL,
    async (_event, workspacePath: string, pageId: string): Promise<Result<void>> => {
      try {
        pagesService.deletePage(workspacePath, pageId);
        return ok(undefined);
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to delete page.');
      }
    }
  );
}
