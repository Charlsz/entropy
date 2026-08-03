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

function mediaMatchesPath(el: HTMLMediaElement, filePath: string): boolean {
  const token = encodePathToken(filePath);
  const candidates = [el.currentSrc, el.getAttribute("src"), el.src].filter(
    (value): value is string => Boolean(value),
  );
  for (const src of candidates) {
    if (src.includes(token)) return true;
    // Fallback: raw path fragments (legacy / decoded URLs).
    const normalized = filePath.replace(/\\/g, "/");
    if (src.includes(encodeURIComponent(filePath)) || src.includes(encodeURIComponent(normalized))) {
      return true;
    }
  }
  return false;
}

/** Tear down Chromium media mappings so Windows can rename/trash the file. */
export function unloadDomMedia(filePath: string): void {
  const media = document.querySelectorAll("video, audio");
  for (const node of media) {
    const el = node as HTMLMediaElement;
    if (!mediaMatchesPath(el, filePath)) continue;
    try {
      el.pause();
    } catch {
      // Ignore pause failures on unmounted media.
    }
    try {
      el.removeAttribute("src");
      el.src = "";
      el.load();
    } catch {
      // Ignore teardown races during unmount.
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Unload Chromium media for a path so Windows can move the file to Recycle Bin.
 * Gallery / context video previews otherwise leave the file locked
 * (shell.trashItem -> "Operation was aborted").
 */
export async function withMediaReleased<T>(
  filePath: string,
  task: () => Promise<T>,
): Promise<T> {
  releasing.add(filePath);
  notify();
  try {
    unloadDomMedia(filePath);
    // Two frames so React can swap video faces to posters, then a settle for Chromium.
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
    await sleep(450);
    unloadDomMedia(filePath);
    await sleep(150);
    return await task();
  } finally {
    releasing.delete(filePath);
    notify();
  }
}
