const MAX_URL_CACHE = 400;

const cache = new Map<string, Promise<string>>();
const thumbCache = new Map<string, Promise<string>>();

function remember(map: Map<string, Promise<string>>, key: string, value: Promise<string>): Promise<string> {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > MAX_URL_CACHE) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
  return value;
}

/** Drop in-memory URL cache (e.g. after protocol format changes). */
export function clearUrlCaches(): void {
  cache.clear();
  thumbCache.clear();
}

export function getFileUrl(filePath: string): Promise<string> {
  const existing = cache.get(filePath);
  if (existing) {
    remember(cache, filePath, existing);
    return existing;
  }
  const pending = window.entropy.fs.toUrl(filePath).catch((error) => {
    cache.delete(filePath);
    throw error;
  });
  return remember(cache, filePath, pending);
}

export function getThumbUrl(filePath: string): Promise<string> {
  const existing = thumbCache.get(filePath);
  if (existing) {
    remember(thumbCache, filePath, existing);
    return existing;
  }
  const pending = window.entropy.fs.toThumbUrl(filePath).catch((error) => {
    thumbCache.delete(filePath);
    throw error;
  });
  return remember(thumbCache, filePath, pending);
}
