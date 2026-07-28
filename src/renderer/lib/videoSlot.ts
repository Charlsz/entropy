/** Cap concurrent video element loads so scrolling stays smooth. */
let active = 0;
const queue: Array<() => void> = [];
const MAX = 2;

export async function withVideoSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX) {
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
}
