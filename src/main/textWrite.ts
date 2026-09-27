import fs from "node:fs/promises";

const MTIME_TOLERANCE_MS = 1;

export type TextWriteResult =
  | { ok: true; mtimeMs: number }
  | { ok: false; reason: "missing" | "conflict"; mtimeMs: number | null };

/**
 * Replace a file's contents only when its mtime still matches.
 * The check and the write share one file handle so a save cannot land on a
 * newer version that appeared after a separate stat.
 */
export async function writeTextIfMtimeMatches(
  filePath: string,
  content: string,
  expectedMtimeMs: number,
): Promise<TextWriteResult> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(filePath, "r+");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { ok: false, reason: "missing", mtimeMs: null };
    throw error;
  }

  try {
    const info = await handle.stat();
    if (Math.abs(info.mtimeMs - expectedMtimeMs) > MTIME_TOLERANCE_MS) {
      return { ok: false, reason: "conflict", mtimeMs: info.mtimeMs };
    }
    const data = Buffer.from(content, "utf8");
    await handle.truncate(0);
    if (data.length > 0) {
      await handle.write(data, 0, data.length, 0);
    }
    await handle.sync();
    const next = await handle.stat();
    return { ok: true, mtimeMs: next.mtimeMs };
  } finally {
    await handle.close();
  }
}
