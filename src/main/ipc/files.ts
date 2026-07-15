import { dialog, ipcMain, shell } from 'electron';
import {
  FILES_FROM_PATH_CHANNEL,
  FILES_IMAGE_PREVIEW_CHANNEL,
  FILES_OPEN_CHANNEL,
  FILES_PICK_CHANNEL,
  FILES_RESOLVE_CHANNEL
} from '../../shared/ipc';
import type { FileRef } from '../../shared/files';
import { err, ok, type Result } from '../../shared/result';
import { buildFileRef, getImagePreviewDataUrl, resolveHref } from '../services/files';
import { isValidWorkspacePath } from '../services/workspace';

export function registerFilesIpc(): void {
  ipcMain.handle(
    FILES_PICK_CHANNEL,
    async (_event, workspacePath: string): Promise<Result<FileRef | null>> => {
      try {
        if (!isValidWorkspacePath(workspacePath)) {
          return err('Workspace folder is missing or invalid.');
        }

        const result = dialog.showOpenDialogSync({
          title: 'Link a file',
          defaultPath: workspacePath,
          properties: ['openFile', 'dontAddToRecent']
        });

        if (!result || result.length === 0) {
          return ok(null);
        }

        const selected = result[0];
        if (!selected) {
          return ok(null);
        }

        return ok(buildFileRef(workspacePath, selected));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to pick a file.');
      }
    }
  );

  ipcMain.handle(FILES_OPEN_CHANNEL, async (_event, filePath: string): Promise<Result<void>> => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return err('Invalid file path.');
      }

      const openError = await shell.openPath(filePath);
      if (openError) {
        return err(openError);
      }

      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error.message : 'Failed to open file.');
    }
  });

  ipcMain.handle(
    FILES_RESOLVE_CHANNEL,
    async (_event, workspacePath: string, href: string): Promise<Result<FileRef>> => {
      try {
        return ok(resolveHref(workspacePath, href));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to resolve file reference.');
      }
    }
  );

  ipcMain.handle(
    FILES_FROM_PATH_CHANNEL,
    async (_event, workspacePath: string, absolutePath: string): Promise<Result<FileRef>> => {
      try {
        if (!absolutePath || typeof absolutePath !== 'string') {
          return err('Invalid file path.');
        }
        return ok(buildFileRef(workspacePath, absolutePath));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to link file path.');
      }
    }
  );

  ipcMain.handle(
    FILES_IMAGE_PREVIEW_CHANNEL,
    async (_event, filePath: string): Promise<Result<string | null>> => {
      try {
        if (!filePath || typeof filePath !== 'string') {
          return err('Invalid file path.');
        }
        return ok(getImagePreviewDataUrl(filePath));
      } catch (error) {
        return err(error instanceof Error ? error.message : 'Failed to load image preview.');
      }
    }
  );
}
