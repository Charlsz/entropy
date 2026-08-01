const cache = new Map<string, Promise<string>>();
const thumbCache = new Map<string, Promise<string>>();

/** Drop in-memory URL cache (e.g. after protocol format changes). */
export function clearUrlCaches(): void {
  cache.clear();
  thumbCache.clear();
}

export function getFileUrl(filePath: string): Promise<string> {
  let pending = cache.get(filePath);
  if (!pending) {
    pending = window.entropy.fs.toUrl(filePath).catch((error) => {
      cache.delete(filePath);
      throw error;
    });
    cache.set(filePath, pending);
  }
  return pending;
}

export function getThumbUrl(filePath: string): Promise<string> {
  let pending = thumbCache.get(filePath);
  if (!pending) {
    pending = window.entropy.fs.toThumbUrl(filePath).catch((error) => {
      thumbCache.delete(filePath);
      throw error;
    });
    thumbCache.set(filePath, pending);
  }
  return pending;
}
