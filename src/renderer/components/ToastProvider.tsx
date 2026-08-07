import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { osTrashName } from "../lib/platform";

const DEFAULT_TTL_MS = 15_000;

export type AppToast = {
  id: string;
  createdAt: number;
  /** Primary line */
  title: string;
  /** Muted trailing detail (e.g. size) */
  detail?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  /** Open OS Recycle Bin / Trash (delete toasts). */
  showOpenTrash?: boolean;
  /** Runs on dismiss (X / TTL), not after a successful Undo action. */
  onDismiss?: () => void | Promise<void>;
  busy?: boolean;
};

type PushToastInput = Omit<AppToast, "id" | "createdAt" | "busy"> & {
  id?: string;
  ttlMs?: number;
};

type ToastContextValue = {
  toasts: AppToast[];
  pushToast: (input: PushToastInput) => string;
  dismissToast: (id: string, reason?: "manual" | "ttl" | "action") => void;
  updateToast: (id: string, patch: Partial<Pick<AppToast, "busy" | "title" | "detail">>) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useAppToasts(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useAppToasts must be used within ToastProvider");
  }
  return ctx;
}

/** Safe when provider may be absent (boot screens). */
export function useOptionalAppToasts(): ToastContextValue | null {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;
  const timersRef = useRef(new Map<string, number>());
  const dismissedRef = useRef(new Set<string>());

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id: string, reason: "manual" | "ttl" | "action" = "manual") => {
      if (dismissedRef.current.has(id)) return;
      dismissedRef.current.add(id);
      clearTimer(id);
      const existing = toastsRef.current.find((item) => item.id === id);
      setToasts((prev) => prev.filter((item) => item.id !== id));
      if (existing && reason !== "action") {
        void existing.onDismiss?.();
      }
    },
    [clearTimer],
  );

  const pushToast = useCallback(
    (input: PushToastInput) => {
      const id = input.id ?? crypto.randomUUID();
      const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
      dismissedRef.current.delete(id);
      clearTimer(id);

      const next: AppToast = {
        id,
        createdAt: Date.now(),
        title: input.title,
        detail: input.detail,
        actionLabel: input.actionLabel,
        onAction: input.onAction,
        showOpenTrash: input.showOpenTrash,
        onDismiss: input.onDismiss,
        busy: false,
      };

      setToasts((prev) => {
        const without = prev.filter((item) => item.id !== id);
        return [...without, next];
      });

      timersRef.current.set(
        id,
        window.setTimeout(() => {
          dismissToast(id, "ttl");
        }, ttlMs),
      );

      return id;
    },
    [clearTimer, dismissToast],
  );

  const updateToast = useCallback((id: string, patch: Partial<Pick<AppToast, "busy" | "title" | "detail">>) => {
    setToasts((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ toasts, pushToast, dismissToast, updateToast }),
    [toasts, pushToast, dismissToast, updateToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack />
    </ToastContext.Provider>
  );
}

function ToastStack() {
  const { toasts, dismissToast, updateToast } = useAppToasts();
  const trashName = osTrashName();

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          trashName={trashName}
          onDismiss={() => dismissToast(toast.id, "manual")}
          onAction={async () => {
            if (!toast.onAction) return;
            updateToast(toast.id, { busy: true });
            try {
              await toast.onAction();
              dismissToast(toast.id, "action");
            } catch {
              updateToast(toast.id, { busy: false });
            }
          }}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  trashName,
  onDismiss,
  onAction,
}: {
  toast: AppToast;
  trashName: string;
  onDismiss: () => void;
  onAction: () => void;
}) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1.5 text-foreground shadow-sm"
      role="status"
    >
      <div className="min-w-0 flex-1 text-[12px] leading-snug">
        <p>
          <span className="font-medium">{toast.title}</span>
          {toast.detail ? (
            <span className="text-muted-foreground"> · {toast.detail}</span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {toast.showOpenTrash ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                disabled={toast.busy}
                aria-label={`Open ${trashName}`}
                onClick={() => void window.entropy.fs.openTrash()}
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open {trashName}</TooltipContent>
          </Tooltip>
        ) : null}
        {toast.actionLabel && toast.onAction ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px]"
            disabled={toast.busy}
            onClick={() => void onAction()}
          >
            {toast.actionLabel}
          </Button>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              disabled={toast.busy}
              aria-label="Dismiss"
              onClick={onDismiss}
            >
              <X className="h-3 w-3" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Dismiss</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
