/** Cap concurrent async work so UI stays responsive under bursty loads. */
export function createSlot(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  return async function withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      const next = queue.shift();
      if (next) next();
    }
  };
}
