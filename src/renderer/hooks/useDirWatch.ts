import { useEffect, useRef } from "react";
import { samePath } from "../lib/platform";

/**
 * Keep a directory listing live with external disk changes.
 * Main process debounces; callback should do a quiet refresh.
 */
export function useDirWatch(
  dirPath: string | null | undefined,
  onChange: (dirPath: string) => void,
  options?: { recursive?: boolean; enabled?: boolean },
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const enabled = options?.enabled ?? true;
  const recursive = options?.recursive ?? false;

  useEffect(() => {
    if (!dirPath || !enabled) return;

    void window.entropy.fs.watchDir(dirPath, { recursive });
    const stop = window.entropy.fs.onDirChanged((info) => {
      if (samePath(info.path, dirPath)) {
        onChangeRef.current(info.path);
      }
    });

    return () => {
      stop();
      void window.entropy.fs.unwatchDir(dirPath);
    };
  }, [dirPath, enabled, recursive]);
}
