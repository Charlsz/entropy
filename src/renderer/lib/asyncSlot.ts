/** Cap concurrent async work so UI stays responsive under bursty loads. */
export function createSlot(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function wakeNext(): void {
    const next = queue.shift();
    if (next) next();
  }

  async function withSlot<T>(task: () => Promise<T>): Promise<T>;
  async function withSlot<T>(
    task: () => Promise<T>,
    isCancelled: () => boolean,
  ): Promise<T | undefined>;
  async function withSlot<T>(
    task: () => Promise<T>,
    isCancelled?: () => boolean,
  ): Promise<T | undefined> {
    if (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    // Skip work queued by unmounted cards (e.g. after sort) so fresh mounts are not starved.
    if (isCancelled?.()) {
      wakeNext();
      return undefined;
    }
    active += 1;
    try {
      if (isCancelled?.()) return undefined;
      return await task();
    } finally {
      active -= 1;
      wakeNext();
    }
  }

  return withSlot;
}
