import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ChromeTitlebarContextValue {
  slotEl: HTMLElement | null;
  setSlotEl: (el: HTMLElement | null) => void;
}

const ChromeTitlebarContext = createContext<ChromeTitlebarContextValue | null>(null);

/** Owns the DOM mount point for Library/Notebook caption content. */
export function ChromeTitlebarProvider({ children }: { children: ReactNode }) {
  const [slotEl, setSlotElState] = useState<HTMLElement | null>(null);
  const setSlotEl = useCallback((el: HTMLElement | null) => {
    setSlotElState((prev) => (prev === el ? prev : el));
  }, []);
  const value = useMemo(() => ({ slotEl, setSlotEl }), [slotEl, setSlotEl]);
  return (
    <ChromeTitlebarContext.Provider value={value}>{children}</ChromeTitlebarContext.Provider>
  );
}

/** Mount point in the shell title strip. */
export function ChromeTitlebarSlot({ className }: { className?: string }) {
  const ctx = useContext(ChromeTitlebarContext);
  const setSlotEl = ctx?.setSlotEl;
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      setSlotEl?.(el);
    },
    [setSlotEl],
  );
  return <div className={className} ref={ref} />;
}

/**
 * Portals leading titlebar content into the shell strip.
 * Portal avoids setState(children) loops from inline JSX identities.
 */
export function ChromeTitlebarStart({ children }: { children: ReactNode }) {
  const ctx = useContext(ChromeTitlebarContext);
  if (!ctx?.slotEl) return null;
  return createPortal(children, ctx.slotEl);
}
