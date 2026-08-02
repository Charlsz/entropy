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

function releaseDomMedia(filePath: string): void {
  const token = encodePathToken(filePath);
  const media = document.querySelectorAll("video, audio");
  for (const node of media) {
    const el = node as HTMLMediaElement;
    const src = el.currentSrc || el.getAttribute("src") || "";
    if (!src.includes(token)) continue;
    try {
      el.pause();
    } catch {
      // Ignore pause failures on unmounted media.
    }
    el.removeAttribute("src");
    el.load();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Unload Chromium media for a path briefly so Windows can move the file to Recycle Bin.
 * Gallery video previews otherwise leave the file locked (shell.trashItem -> "Operation was aborted").
 */
export async function withMediaReleased<T>(
  filePath: string,
  task: () => Promise<T>,
): Promise<T> {
  releasing.add(filePath);
  notify();
  try {
    releaseDomMedia(filePath);
    // Two frames so React can swap video faces to posters, then a short settle.
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
    await sleep(220);
    releaseDomMedia(filePath);
    return await task();
  } finally {
    releasing.delete(filePath);
    notify();
  }
}
