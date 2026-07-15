/**
 * Reference store — the in-memory source of truth for file-page relationships.
 *
 * This is a plain module (not a React context) so it can be imported by
 * both renderer and main process without coupling to React.
 *
 * Persistence: call serialize() to get a JSON string, deserialize() to restore.
 * The main process writes this to disk; the renderer only reads/writes the store.
 */

import { FileReference, ReferenceMap } from './types';

function emptyMap(): ReferenceMap {
  return { byPage: {}, byFile: {} };
}

let _store: ReferenceMap = emptyMap();

export const referenceStore = {
  /** Add a reference. Idempotent by refId. */
  add(ref: FileReference): void {
    const pageRefs = _store.byPage[ref.pageId] ?? [];
    if (pageRefs.some((r) => r.refId === ref.refId)) return;
    _store.byPage[ref.pageId] = [...pageRefs, ref];

    const filePages = _store.byFile[ref.fileId] ?? [];
    if (!filePages.includes(ref.pageId)) {
      _store.byFile[ref.fileId] = [...filePages, ref.pageId];
    }
  },

  /** Remove a specific reference by refId. */
  remove(refId: string): void {
    for (const pageId of Object.keys(_store.byPage)) {
      const before = _store.byPage[pageId];
      const removed = before.find((r) => r.refId === refId);
      if (!removed) continue;

      _store.byPage[pageId] = before.filter((r) => r.refId !== refId);

      // Update inverse index
      const filePages = _store.byFile[removed.fileId] ?? [];
      const stillRef = _store.byPage[pageId].some((r) => r.fileId === removed.fileId);
      if (!stillRef) {
        _store.byFile[removed.fileId] = filePages.filter((p) => p !== pageId);
      }
      return;
    }
  },

  /** Get all references for a page. */
  getByPage(pageId: string): FileReference[] {
    return _store.byPage[pageId] ?? [];
  },

  /** Get all page IDs that reference a file. */
  getPagesByFile(fileId: string): string[] {
    return _store.byFile[fileId] ?? [];
  },

  /** Serialize to JSON for persistence. */
  serialize(): string {
    return JSON.stringify(_store);
  },

  /** Restore from JSON (called on app start). */
  deserialize(json: string): void {
    try {
      _store = JSON.parse(json) as ReferenceMap;
    } catch {
      _store = emptyMap();
    }
  },

  /** Reset — used in tests. */
  reset(): void {
    _store = emptyMap();
  },
};
