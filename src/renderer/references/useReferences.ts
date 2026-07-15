/**
 * useReferences — React adapter for the reference store.
 *
 * Returns stable add/remove/query functions.
 * Forces a re-render when references change by keeping a version counter.
 *
 * Why not useReducer?
 * The store is a singleton module. We only need React to know
 * “something changed” — a version bump is the simplest signal.
 */

import { useState, useCallback } from 'react';
import { referenceStore } from './store';
import { FileReference } from './types';

export function useReferences(pageId: string) {
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const add = useCallback(
    (ref: Omit<FileReference, 'pageId'> & { bookId: string }) => {
      referenceStore.add({ ...ref, pageId });
      bump();
    },
    [pageId, bump]
  );

  const remove = useCallback(
    (refId: string) => {
      referenceStore.remove(refId);
      bump();
    },
    [bump]
  );

  const refs = referenceStore.getByPage(pageId);

  return { refs, add, remove };
}
