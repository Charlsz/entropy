/** Primary app sections. Canvas is retained for a future release but hidden in v1 nav. */
export type SectionId = "notebook" | "inventory" | "canvas" | "settings";

/** Sections shown in the primary icon rail (v1). */
export const VISIBLE_SECTIONS: SectionId[] = ["notebook", "inventory"];
