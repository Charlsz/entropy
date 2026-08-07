import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ChromeTitlebarContextValue {
  start: ReactNode;
  setStart: (node: ReactNode) => void;
}

const ChromeTitlebarContext = createContext<ChromeTitlebarContextValue | null>(null);

/** Owns the shared caption slot used by the shell title strip. */
export function ChromeTitlebarProvider({ children }: { children: ReactNode }) {
  const [start, setStart] = useState<ReactNode>(null);
  const value = useMemo(() => ({ start, setStart }), [start]);
  return (
    <ChromeTitlebarContext.Provider value={value}>{children}</ChromeTitlebarContext.Provider>
  );
}

export function useChromeTitlebarStart(): ReactNode {
  return useContext(ChromeTitlebarContext)?.start ?? null;
}

/**
 * Registers leading titlebar content (breadcrumb / duplicates chrome).
 * Renders nothing in-place — the shell title strip displays the slot.
 */
export function ChromeTitlebarStart({ children }: { children: ReactNode }) {
  const ctx = useContext(ChromeTitlebarContext);
  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.setStart(children);
    return () => ctx.setStart(null);
  }, [ctx, children]);
  return null;
}
