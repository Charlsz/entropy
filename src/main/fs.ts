import { shell, type WebContents } from "electron";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { FileEntry, NoteSearchResult, TreeNode } from "../shared/types";
import { assertPathMutable, isProtectedOsDirName, isProtectedOsPath } from "../shared/protectedPaths";
import { releaseFileReaders } from "./protocol";
import { removeToTrash } from "./trash";
import { mapPool } from "./asyncPool";

const execFileAsync = promisify(execFile);

const platform = process.platform;

function shouldSkipDirName(name: string): boolean {
  return isProtectedOsDirName(name, platform);
}

function toEntry(filePath: string, stat: { isDirectory(): boolean; size: number; mtimeMs: number }): FileEntry {
  const name = path.basename(filePath);
  return {
    name,
    path: filePath,
    isDirectory: stat.isDirectory(),
    size: stat.size,
    modifiedAt: stat.mtimeMs,
    extension: stat.isDirectory() ? "" : path.extname(name).toLowerCase(),
  };
}

const STAT_BATCH = 48;

function isPermissionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EPERM" || code === "EACCES" || code === "ENOENT";
}

export async function listDir(dirPath: string): Promise<FileEntry[]> {
  let dirents;
  try {
    dirents = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (isPermissionError(error)) return [];
    throw error;
  }

  const entries: FileEntry[] = [];
  const targets = dirents.filter(
    (entry) => entry.name !== "." && entry.name !== ".." && !shouldSkipDirName(entry.name),
  );

  for (let i = 0; i < targets.length; i += STAT_BATCH) {
    const batch = targets.slice(i, i + STAT_BATCH);
    const settled = await Promise.all(
      batch.map(async (dirent) => {
        const fullPath = path.join(dirPath, dirent.name);
        try {
          // Fast path: plain files — one lstat (size + mtime).
          if (dirent.isFile()) {
            const info = await fs.lstat(fullPath);
            if (info.isSymbolicLink()) {
              const target = await fs.stat(fullPath);
              if (target.isDirectory()) return null;
              return toEntry(fullPath, target);
            }
            return toEntry(fullPath, info);
          }

          // Directories / junctions / odd types — keep safer link handling.
          const linkInfo = await fs.lstat(fullPath);
          if (linkInfo.isSymbolicLink() && (dirent.isDirectory() || linkInfo.isDirectory())) {
            try {
              await fs.access(fullPath);
              const target = await fs.stat(fullPath);
              if (!target.isDirectory()) return toEntry(fullPath, target);
              if (shouldSkipDirName(dirent.name)) return null;
              return toEntry(fullPath, target);
            } catch {
              return null;
            }
          }
          const info =
            linkInfo.isDirectory() || linkInfo.isFile() ? linkInfo : await fs.stat(fullPath);
          return toEntry(fullPath, info);
        } catch {
          return null;
        }
      }),
    );
    for (const entry of settled) {
      if (entry) entries.push(entry);
    }
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return entries;
}

export async function readText(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") {
      throw new Error(`File not found: ${path.basename(filePath)}`);
    }
    throw error;
  }
}

/** Atomic write: temp file in same directory, then rename. */
export async function writeText(filePath: string, content: string): Promise<void> {
  assertPathMutable(filePath, platform, "write");
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    await fs.writeFile(tempPath, content, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup failures.
    }
    throw error;
  }
}

export async function writeTextIfUnchanged(
  filePath: string,
  content: string,
  expectedMtimeMs: number | null,
): Promise<{ ok: true; mtimeMs: number } | { ok: false; reason: "missing" | "conflict"; mtimeMs: number | null }> {
  try {
    const info = await fs.stat(filePath);
    if (expectedMtimeMs !== null && Math.abs(info.mtimeMs - expectedMtimeMs) > 1) {
      return { ok: false, reason: "conflict", mtimeMs: info.mtimeMs };
    }
  } catch {
    if (expectedMtimeMs !== null) {
      return { ok: false, reason: "missing", mtimeMs: null };
    }
  }

  await writeText(filePath, content);
  const next = await fs.stat(filePath);
  return { ok: true, mtimeMs: next.mtimeMs };
}

export async function mkdir(dirPath: string): Promise<void> {
  assertPathMutable(dirPath, platform, "create");
  await fs.mkdir(dirPath, { recursive: true });
}

export async function rename(fromPath: string, toPath: string): Promise<void> {
  assertPathMutable(fromPath, platform, "rename");
  assertPathMutable(toPath, platform, "rename into");
  await fs.rename(fromPath, toPath);
}

export async function remove(targetPath: string, sender?: WebContents): Promise<void> {
  assertPathMutable(targetPath, platform, "delete");
  if (sender && !sender.isDestroyed()) {
    try {
      await sender.executeJavaScript(
        `typeof window.__entropyReleaseMedia==="function"&&window.__entropyReleaseMedia(${JSON.stringify(targetPath)})`,
      );
    } catch {
      // Renderer may be mid-reload.
    }
  }
  await releaseFileReaders(targetPath);
  await removeToTrash(targetPath);
}

export async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function stat(targetPath: string): Promise<FileEntry> {
  const info = await fs.stat(targetPath);
  return toEntry(targetPath, info);
}

export async function folderTree(rootPath: string, maxDepth = 6): Promise<TreeNode[]> {
  async function walk(dirPath: string, depth: number): Promise<TreeNode[]> {
    if (depth > maxDepth) return [];
    let dirents;
    try {
      dirents = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: TreeNode[] = [];
    for (const dirent of dirents) {
      if (!dirent.isDirectory() && !dirent.isSymbolicLink()) continue;
      if (shouldSkipDirName(dirent.name)) continue;
      const fullPath = path.join(dirPath, dirent.name);
      try {
        const linkInfo = await fs.lstat(fullPath);
        if (linkInfo.isSymbolicLink()) {
          try {
            await fs.access(fullPath);
          } catch {
            continue;
          }
        } else if (!linkInfo.isDirectory()) {
          continue;
        }
      } catch {
        continue;
      }
      nodes.push({
        name: dirent.name,
        path: fullPath,
        isDirectory: true,
        children: await walk(fullPath, depth + 1),
      });
    }

    nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return nodes;
  }

  return walk(rootPath, 0);
}

export async function listMarkdown(rootPath: string, maxDepth = 10): Promise<FileEntry[]> {
  const results: FileEntry[] = [];

  async function walk(dirPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let dirents;
    try {
      dirents = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    const subdirs: string[] = [];
    for (const dirent of dirents) {
      if (shouldSkipDirName(dirent.name)) continue;
      const fullPath = path.join(dirPath, dirent.name);
      if (dirent.isDirectory()) {
        subdirs.push(fullPath);
        continue;
      }
      if (path.extname(dirent.name).toLowerCase() !== ".md") continue;
      try {
        const info = await fs.stat(fullPath);
        results.push(toEntry(fullPath, info));
      } catch {
        // Skip.
      }
    }

    const batch = 8;
    for (let i = 0; i < subdirs.length; i += batch) {
      await Promise.all(subdirs.slice(i, i + batch).map((dir) => walk(dir, depth + 1)));
    }
  }

  await walk(rootPath, 0);
  results.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return results;
}

export async function searchMarkdown(
  rootPath: string,
  query: string,
): Promise<NoteSearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const notes = await listMarkdown(rootPath);
  const results: NoteSearchResult[] = [];

  for (const note of notes) {
    const nameMatch = note.name.toLowerCase().includes(trimmed);
    let excerpt = "";
    let contentMatch = false;

    try {
      const content = await fs.readFile(note.path, "utf8");
      const lower = content.toLowerCase();
      const index = lower.indexOf(trimmed);
      if (index >= 0) {
        contentMatch = true;
        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + trimmed.length + 60);
        excerpt = content.slice(start, end).replace(/\s+/g, " ").trim();
        if (start > 0) excerpt = `…${excerpt}`;
        if (end < content.length) excerpt = `${excerpt}…`;
      } else if (nameMatch) {
        excerpt = content.slice(0, 100).replace(/\s+/g, " ").trim();
      }
    } catch {
      // Skip unreadable.
    }

    if (nameMatch || contentMatch) {
      results.push({
        path: note.path,
        name: note.name,
        excerpt,
      });
    }

    if (results.length >= 100) break;
  }

  return results;
}

const MD_LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)/g;

function normalizePathKey(filePath: string): string {
  return path.resolve(filePath).replace(/[/\\]+$/, "").toLowerCase();
}

/** Notes that contain a markdown link resolving to targetNotePath. */
export async function findBacklinks(
  rootPath: string,
  targetNotePath: string,
): Promise<NoteSearchResult[]> {
  const targetKey = normalizePathKey(targetNotePath);
  const targetBase = path.basename(targetNotePath).toLowerCase();
  const notes = await listMarkdown(rootPath);
  const results: NoteSearchResult[] = [];

  for (const note of notes) {
    if (normalizePathKey(note.path) === targetKey) continue;

    let content: string;
    try {
      content = await fs.readFile(note.path, "utf8");
    } catch {
      continue;
    }

    const noteDir = path.dirname(note.path);
    MD_LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    let linked = false;

    while ((match = MD_LINK_RE.exec(content)) !== null) {
      const href = match[2];
      if (/^(https?:|mailto:)/i.test(href)) continue;

      const resolved = path.resolve(noteDir, href);
      const resolvedKey = normalizePathKey(resolved);
      const hrefBase = path.basename(href).toLowerCase();

      if (
        resolvedKey === targetKey ||
        resolvedKey === `${targetKey}.md` ||
        hrefBase === targetBase
      ) {
        linked = true;
        break;
      }
    }

    if (!linked) continue;

    const excerpt = content.slice(0, 120).replace(/\s+/g, " ").trim();
    results.push({
      path: note.path,
      name: note.name,
      excerpt: excerpt ? `${excerpt}${content.length > 120 ? "…" : ""}` : "",
    });

    if (results.length >= 50) break;
  }

  return results;
}

/** Notes that link to any file (same resolution rules as note backlinks). */
export async function findFileReferences(
  workspacePath: string,
  filePath: string,
): Promise<NoteSearchResult[]> {
  return findBacklinks(workspacePath, filePath);
}

const DUP_MAX_DEPTH = 10;
const DUP_MAX_RESULTS = 24;
const DUP_HASH_CACHE = new Map<string, { hash: string; mtimeMs: number; size: number }>();

export async function hashFile(filePath: string): Promise<string> {
  const info = await fs.stat(filePath);
  const cached = DUP_HASH_CACHE.get(filePath);
  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
    return cached.hash;
  }

  const hash = await new Promise<string>((resolve, reject) => {
    const hasher = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hasher.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hasher.digest("hex")));
  });

  DUP_HASH_CACHE.set(filePath, { hash, mtimeMs: info.mtimeMs, size: info.size });
  return hash;
}

function toFileEntry(full: string, name: string, size: number, mtimeMs: number): FileEntry {
  return {
    name,
    path: full,
    isDirectory: false,
    size,
    modifiedAt: mtimeMs,
    extension: path.extname(name).toLowerCase(),
  };
}

/** Content-identical copies under root (same SHA-256). Excludes the target itself. */
export async function findDuplicates(
  rootPath: string,
  filePath: string,
): Promise<FileEntry[]> {
  const target = path.resolve(filePath);
  if (isProtectedOsPath(target, platform) || isProtectedOsPath(rootPath, platform)) {
    return [];
  }
  let targetStat;
  try {
    targetStat = await fs.stat(target);
  } catch {
    return [];
  }
  if (!targetStat.isFile() || targetStat.size <= 0) return [];

  let targetHash: string;
  try {
    targetHash = await hashFile(target);
  } catch {
    return [];
  }

  const targetSize = targetStat.size;
  const targetKey = normalizePathKey(target);
  const candidates: Array<{ path: string; name: string; size: number; mtimeMs: number }> = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > DUP_MAX_DEPTH || candidates.length >= DUP_MAX_RESULTS * 4) return;
    if (isProtectedOsPath(dir, platform)) return;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const subdirs: string[] = [];
    for (const dirent of dirents) {
      if (dirent.name === "." || dirent.name === "..") continue;
      if (shouldSkipDirName(dirent.name)) continue;
      const full = path.join(dir, dirent.name);
      if (isProtectedOsPath(full, platform)) continue;
      try {
        if (dirent.isSymbolicLink()) continue;
        if (dirent.isDirectory()) {
          subdirs.push(full);
          continue;
        }
        if (!dirent.isFile()) continue;
        const link = await fs.lstat(full);
        if (link.isSymbolicLink() || !link.isFile()) continue;
        if (link.size !== targetSize) continue;
        if (normalizePathKey(full) === targetKey) continue;
        candidates.push({
          path: full,
          name: dirent.name,
          size: link.size,
          mtimeMs: link.mtimeMs,
        });
      } catch {
        // Skip inaccessible.
      }
    }

    await mapPool(subdirs, 4, async (subdir) => {
      await walk(subdir, depth + 1);
    });
  }

  await walk(path.normalize(rootPath), 0);

  const matches = await mapPool(candidates, 4, async (candidate) => {
    try {
      const hash = await hashFile(candidate.path);
      if (hash !== targetHash) return null;
      return toFileEntry(candidate.path, candidate.name, candidate.size, candidate.mtimeMs);
    } catch {
      return null;
    }
  });

  return matches.filter((entry): entry is FileEntry => entry != null).slice(0, DUP_MAX_RESULTS);
}

export async function createNote(dirPath: string, name?: string): Promise<string> {
  const base = (name?.trim() || "Untitled").replace(/[<>:"/\\|?*]/g, "").replace(/\.md$/i, "");
  let filePath = path.join(dirPath, `${base}.md`);
  let suffix = 1;

  while (await exists(filePath)) {
    suffix += 1;
    filePath = path.join(dirPath, `${base} ${suffix}.md`);
  }

  await writeText(filePath, "");
  return filePath;
}

export async function duplicate(targetPath: string): Promise<string> {
  const dir = path.dirname(targetPath);
  assertPathMutable(dir, platform, "duplicate into");
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let next = path.join(dir, `${base} copy${ext}`);
  let suffix = 2;

  while (await exists(next)) {
    next = path.join(dir, `${base} copy ${suffix}${ext}`);
    suffix += 1;
  }

  assertPathMutable(next, platform, "duplicate into");
  const info = await fs.stat(targetPath);
  if (info.isDirectory()) {
    await fs.cp(targetPath, next, { recursive: true });
  } else {
    await fs.copyFile(targetPath, next);
  }

  return next;
}

export async function revealInFolder(targetPath: string): Promise<void> {
  shell.showItemInFolder(targetPath);
}

export async function openExternal(targetPath: string): Promise<void> {
  await shell.openPath(targetPath);
}

/** Open the OS Recycle Bin / Trash so the user can find recently deleted files. */
export async function openOsTrash(): Promise<void> {
  if (process.platform === "win32") {
    try {
      await shell.openExternal("shell:RecycleBinFolder");
      return;
    } catch {
      // Fall through to explorer.
    }
    try {
      await execFileAsync("explorer.exe", ["shell:RecycleBinFolder"]);
    } catch (err) {
      // explorer.exe often exits with code 1 even after opening the window successfully.
      const code = (err as { code?: number | string } | null)?.code;
      if (code === 1 || code === "1") return;
      throw err;
    }
    return;
  }
  if (process.platform === "darwin") {
    await shell.openPath(path.join(os.homedir(), ".Trash"));
    return;
  }
  await shell.openPath(path.join(os.homedir(), ".local", "share", "Trash", "files"));
}

const EMBED_FIND_MAX_DEPTH = 14;
const EMBED_FIND_MAX_FILES = 8000;

async function findFileByName(rootPath: string, fileName: string): Promise<string | null> {
  const want = fileName.toLowerCase();
  let seen = 0;

  async function walk(dir: string, depth: number): Promise<string | null> {
    if (depth > EMBED_FIND_MAX_DEPTH || seen >= EMBED_FIND_MAX_FILES) return null;
    if (isProtectedOsPath(dir, platform)) return null;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }

    const subdirs: string[] = [];
    for (const dirent of dirents) {
      if (dirent.name === "." || dirent.name === "..") continue;
      if (shouldSkipDirName(dirent.name)) continue;
      const full = path.join(dir, dirent.name);
      if (dirent.isFile()) {
        seen += 1;
        if (dirent.name.toLowerCase() === want) return full;
      } else if (dirent.isDirectory()) {
        subdirs.push(full);
      }
    }

    for (const sub of subdirs) {
      const hit = await walk(sub, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  return walk(path.normalize(rootPath), 0);
}

/**
 * Resolve Obsidian `![[target]]` / markdown / HTML media targets.
 * Preference order: absolute → path relative to the Markdown file → workspace → basename search.
 * Relative paths are intentionally note-based (filesystem-is-truth), not workspace-root-based.
 */
export async function resolveEmbedTarget(
  target: string,
  notePath: string,
  workspacePath?: string | null,
): Promise<string | null> {
  const cleaned = target.trim().replace(/^<|>$/g, "").replace(/\\/g, "/");
  if (!cleaned) return null;

  const candidates: string[] = [];

  if (/^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(cleaned)) {
    candidates.push(path.normalize(cleaned));
  }

  const noteDir = path.dirname(notePath);
  candidates.push(path.resolve(noteDir, cleaned));

  if (workspacePath) {
    candidates.push(path.resolve(workspacePath, cleaned));
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = normalizePathKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const info = await fs.stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // try next
    }
  }

  const baseName = path.basename(cleaned);
  const searchRoots = [noteDir, workspacePath].filter(Boolean) as string[];
  const searched = new Set<string>();
  for (const root of searchRoots) {
    const key = normalizePathKey(root);
    if (searched.has(key)) continue;
    searched.add(key);
    const hit = await findFileByName(root, baseName);
    if (hit) return hit;
  }

  return null;
}
