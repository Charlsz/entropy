import { createSlot } from "./asyncSlot";

/** Cap concurrent video element loads so scrolling stays smooth. */
export const withVideoSlot = createSlot(2);
