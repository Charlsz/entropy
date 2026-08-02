import type { NoteSearchResult, RecentWorkspace } from "../../shared/types";
import { samePath } from "./platform";

export interface FileConnection {
  notePath: string;
  noteName: string;
  workspacePath: string;
  workspaceName: string;
}

/** Current workspace first, then recent workspaces (deduped). */
export async function listSearchableWorkspaces(current: {
  path: string;
  name: string;
}): Promise<Array<{ path: string; name: string }>> {
  const recent = await window.entropy.workspace.getRecent().catch(() => [] as RecentWorkspace[]);
  const out: Array<{ path: string; name: string }> = [{ path: current.path, name: current.name }];
  for (const item of recent) {
    if (out.some((entry) => samePath(entry.path, item.path))) continue;
    out.push({ path: item.path, name: item.name });
  }
  return out;
}

/** Notes (across recent workspaces) that reference this file path. */
export async function findFileConnections(
  filePath: string,
  currentWorkspace: { path: string; name: string },
): Promise<FileConnection[]> {
  const workspaces = await listSearchableWorkspaces(currentWorkspace);
  const batches = await Promise.all(
    workspaces.map(async (ws) => {
      const refs: NoteSearchResult[] = await window.entropy.fs
        .findFileReferences(ws.path, filePath)
        .catch(() => []);
      return refs.map(
        (note): FileConnection => ({
          notePath: note.path,
          noteName: note.name.replace(/\.md$/i, ""),
          workspacePath: ws.path,
          workspaceName: ws.name,
        }),
      );
    }),
  );

  const seen = new Set<string>();
  const connections: FileConnection[] = [];
  for (const item of batches.flat()) {
    const key = `${item.workspacePath}\0${item.notePath}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    connections.push(item);
  }
  return connections;
}
