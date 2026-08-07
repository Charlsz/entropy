import { samePath } from "./platform";

const releasing = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function encodePathToken(filePath: string): string {
  const bytes = new TextEncoder().encode(filePath);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** True while a path is being prepared for trash (unload media / open handles). */
export function isMediaReleasing(filePath: string): boolean {
  for (const item of releasing) {
    if (samePath(item, filePath)) return true;
  }
  return false;
}

export function subscribeMediaRelease(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function urlMatchesPath(src: string, filePath: string): boolean {
  if (!src) return false;
  const token = encodePathToken(filePath);
  if (src.includes(token)) return true;
  const normalized = filePath.replace(/\\/g, "/");
  return (
    src.includes(encodeURIComponent(filePath)) || src.includes(encodeURIComponent(normalized))
  );
}

function mediaMatchesPath(el: HTMLMediaElement, filePath: string): boolean {
  const candidates = [el.currentSrc, el.getAttribute("src"), el.src].filter(
    (value): value is string => Boolean(value),
  );
  return candidates.some((src) => urlMatchesPath(src, filePath));
}

export function unloadMediaElement(el: HTMLMediaElement | null | undefined): void {
  if (!el) return;
  try {
    el.dataset.entropyUnloading = "1";
  } catch {
    // Ignore.
  }
  try {
    el.pause();
  } catch {
    // Ignore pause failures on unmounted media.
  }
  try {
    while (el.firstChild) el.removeChild(el.firstChild);
    el.removeAttribute("src");
    el.src = "";
    el.removeAttribute("poster");
    el.load();
  } catch {
    // Ignore teardown races during unmount.
  }
}

/** Tear down Chromium media mappings for one path so Windows can rename/trash it. */
export function unloadDomMedia(filePath: string): void {
  for (const node of document.querySelectorAll("video, audio")) {
    const el = node as HTMLMediaElement;
    if (!mediaMatchesPath(el, filePath)) continue;
    unloadMediaElement(el);
  }

  for (const node of document.querySelectorAll("iframe")) {
    const el = node as HTMLIFrameElement;
    const src = el.getAttribute("src") || el.src || "";
    if (!urlMatchesPath(src, filePath)) continue;
    try {
      el.src = "about:blank";
    } catch {
      // Ignore.
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function isBusyTrashError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /still in use|operation was aborted|ebusy|eperm|access is denied|being used by another process|locked|eacces|failed to move|file is in use|aborted/i.test(
    message,
  );
}

/**
 * Mark path releasing, notify subscribers (they must pause sync), and strip matching DOM media.
 * Call while the gallery/inspector card is still mounted whenever possible.
 */
export function stopMediaForPath(filePath: string): void {
  releasing.add(filePath);
  notify();
  unloadDomMedia(filePath);
}

export function clearMediaRelease(filePath: string): void {
  releasing.delete(filePath);
  notify();
}

declare global {
  interface Window {
    __entropyReleaseMedia?: (filePath: string) => void;
  }
}

if (typeof window !== "undefined") {
  window.__entropyReleaseMedia = (filePath: string) => {
    stopMediaForPath(filePath);
  };
}

/**
 * Unload Chromium media for a path so Windows can move the file to Recycle Bin.
 * Prefer calling this before removing the card from the React tree so the video
 * element still exists for a clean pause/src clear.
 */
export async function withMediaReleased<T>(
  filePath: string,
  task: () => Promise<T>,
): Promise<T> {
  stopMediaForPath(filePath);
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      stopMediaForPath(filePath);
      await doubleRaf();
      await sleep(280 + attempt * 200);
      unloadDomMedia(filePath);
      await sleep(80);
      try {
        return await task();
      } catch (err) {
        lastError = err;
        if (!isBusyTrashError(err) || attempt === 5) throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Trash failed"));
  } finally {
    clearMediaRelease(filePath);
  }
}
