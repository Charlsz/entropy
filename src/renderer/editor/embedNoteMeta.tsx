import { createContext, useContext } from "react";

export interface EmbedNoteMeta {
  notePath: string | null;
  diskEpoch: number;
}

const EmbedNoteMetaContext = createContext<EmbedNoteMeta>({
  notePath: null,
  diskEpoch: 0,
});

export const EmbedNoteMetaProvider = EmbedNoteMetaContext.Provider;

/** Active note path for TipTap media faces (storage updates don't re-render node views). */
export function useEmbedNoteMeta(): EmbedNoteMeta {
  return useContext(EmbedNoteMetaContext);
}
