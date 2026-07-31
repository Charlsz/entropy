import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { blake3 } from "@noble/hashes/blake3.js";
import { HASH_BUFFER, PARTIAL_CHUNK } from "./types";

function hex(digest: Uint8Array): string {
  return Buffer.from(digest).toString("hex");
}

/** Read a byte range (inclusive start, exclusive end). */
async function readRange(filePath: string, start: number, end: number): Promise<Buffer> {
  if (end <= start) return Buffer.alloc(0);
  const length = end - start;
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Partial BLAKE3: first + middle + last 64KB (or entire file if < 192KB).
 */
export async function partialHash(filePath: string, size: number): Promise<string> {
  if (size <= PARTIAL_CHUNK * 3) {
    return fullHash(filePath);
  }

  const first = await readRange(filePath, 0, PARTIAL_CHUNK);
  const midStart = Math.max(0, Math.floor(size / 2) - Math.floor(PARTIAL_CHUNK / 2));
  const middle = await readRange(filePath, midStart, midStart + PARTIAL_CHUNK);
  const lastStart = Math.max(0, size - PARTIAL_CHUNK);
  const last = await readRange(filePath, lastStart, size);

  const hasher = blake3.create();
  hasher.update(first);
  hasher.update(middle);
  hasher.update(last);
  return hex(hasher.digest());
}

/** Streaming BLAKE3 over the entire file — never loads the whole file into RAM. */
export async function fullHash(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hasher = blake3.create();
    const stream = createReadStream(filePath, { highWaterMark: HASH_BUFFER });
    stream.on("data", (chunk: string | Buffer) => {
      hasher.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(hex(hasher.digest())));
  });
}

/**
 * Buffered byte-by-byte compare. Stops at first mismatch.
 * Returns true only when every byte is identical (and sizes match).
 */
export async function byteEqual(
  pathA: string,
  pathB: string,
  size: number,
): Promise<boolean> {
  if (pathA === pathB) return true;

  const [a, b] = await Promise.all([fs.open(pathA, "r"), fs.open(pathB, "r")]);
  try {
    const bufA = Buffer.alloc(HASH_BUFFER);
    const bufB = Buffer.alloc(HASH_BUFFER);
    let offset = 0;
    while (offset < size) {
      const toRead = Math.min(HASH_BUFFER, size - offset);
      const [readA, readB] = await Promise.all([
        a.read(bufA, 0, toRead, offset),
        b.read(bufB, 0, toRead, offset),
      ]);
      if (readA.bytesRead !== readB.bytesRead) return false;
      if (readA.bytesRead === 0) break;
      if (!bufA.subarray(0, readA.bytesRead).equals(bufB.subarray(0, readB.bytesRead))) {
        return false;
      }
      offset += readA.bytesRead;
    }
    return offset === size;
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
}

/** Run async tasks with a fixed worker-pool concurrency. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const limit = Math.max(1, concurrency);

  async function run(): Promise<void> {
    while (true) {
      if (signal?.aborted) return;
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}
