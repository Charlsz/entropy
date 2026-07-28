/** Shared flush registry so pending note saves complete before quit. */

type FlushFn = () => Promise<void>;

const flushers = new Set<FlushFn>();

export function registerFlush(fn: FlushFn): () => void {
  flushers.add(fn);
  return () => {
    flushers.delete(fn);
  };
}

export async function flushAll(): Promise<void> {
  await Promise.all([...flushers].map((fn) => fn()));
}
