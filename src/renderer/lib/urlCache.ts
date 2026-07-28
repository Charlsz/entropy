const cache = new Map<string, Promise<string>>();

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
