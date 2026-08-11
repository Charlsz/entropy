const MAX_URL_CACHE = 400;

const cache = new Map<string, string>();
const thumbCache = new Map<string, string>();

function remember(map: Map<string, string>, key: string, value: string): string {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > MAX_URL_CACHE) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
  return value;
}

/** Same encoding as main `protocol.encodePathToken` — no IPC round-trip. */
function encodePathToken(filePath: string): string {
  const bytes = new TextEncoder().encode(filePath);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toEntropyUrl(filePath: string): string {
  return `entropy://local/${encodePathToken(filePath)}`;
}

function toEntropyThumbUrl(filePath: string): string {
  return `entropy://thumb/${encodePathToken(filePath)}`;
}

/** Sync entropy:// URL — same encoding as main protocol (no IPC). */
export function fileUrlSync(filePath: string): string {
  const existing = cache.get(filePath);
  if (existing) return remember(cache, filePath, existing);
  return remember(cache, filePath, toEntropyUrl(filePath));
}

/** Sync entropy:// thumb URL. */
export function thumbUrlSync(filePath: string): string {
  const existing = thumbCache.get(filePath);
  if (existing) return remember(thumbCache, filePath, existing);
  return remember(thumbCache, filePath, toEntropyThumbUrl(filePath));
}

export function getFileUrl(filePath: string): Promise<string> {
  return Promise.resolve(fileUrlSync(filePath));
}

export function getThumbUrl(filePath: string): Promise<string> {
  return Promise.resolve(thumbUrlSync(filePath));
}
