import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { createHash } from "node:crypto";
import type { HashCacheRecord } from "./types";

interface CacheFile {
  version: 1;
  records: Record<string, HashCacheRecord>;
}

function cachePathForRoot(rootPath: string): string {
  const key = createHash("sha1").update(path.normalize(rootPath).toLowerCase()).digest("hex");
  return path.join(app.getPath("userData"), "duplicate-cache", `${key}.json`);
}

export class DuplicateHashCache {
  private records = new Map<string, HashCacheRecord>();
  private dirty = false;
  private readonly filePath: string;

  constructor(rootPath: string) {
    this.filePath = cachePathForRoot(rootPath);
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as CacheFile;
      if (parsed?.version !== 1 || !parsed.records) return;
      for (const [key, record] of Object.entries(parsed.records)) {
        this.records.set(key, record);
      }
    } catch {
      // Missing or corrupt cache is fine — rebuild.
    }
  }

  get(
    filePath: string,
    size: number,
    mtimeMs: number,
    ino: number | null,
  ): HashCacheRecord | null {
    const record = this.records.get(normalizeKey(filePath));
    if (!record) return null;
    if (record.size !== size) return null;
    if (record.mtimeMs !== mtimeMs) return null;
    if (ino != null && record.ino != null && record.ino !== ino) return null;
    return record;
  }

  set(record: HashCacheRecord): void {
    this.records.set(normalizeKey(record.path), record);
    this.dirty = true;
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    const payload: CacheFile = {
      version: 1,
      records: Object.fromEntries(this.records.entries()),
    };
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(payload), "utf8");
    this.dirty = false;
  }
}

function normalizeKey(filePath: string): string {
  return path.normalize(filePath).toLowerCase();
}
