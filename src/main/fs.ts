import { shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileEntry, NoteSearchResult, TreeNode } from "../shared/types";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".cache",
]);

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

export async function listDir(dirPath: string): Promise<FileEntry[]> {
  const names = await fs.readdir(dirPath);
  const entries: FileEntry[] = [];

  for (const name of names) {
    if (name === "." || name === "..") continue;
    const fullPath = path.join(dirPath, name);
    try {
      const stat = await fs.stat(fullPath);
      entries.push(toEntry(fullPath, stat));
    } catch {
      // Skip unreadable entries.
    }
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return entries;
}

export async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

/** Atomic write: temp file in same directory, then rename. */
export async function writeText(filePath: string, content: string): Promise<void> {
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
  await fs.mkdir(dirPath, { recursive: true });
}

export async function rename(fromPath: string, toPath: string): Promise<void> {
  await fs.rename(fromPath, toPath);
}

export async function remove(targetPath: string): Promise<void> {
  await shell.trashItem(targetPath);
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
    const names = await fs.readdir(dirPath);
    const nodes: TreeNode[] = [];

    for (const name of names) {
      if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
      const fullPath = path.join(dirPath, name);
      try {
        const info = await fs.stat(fullPath);
        if (!info.isDirectory()) continue;
        nodes.push({
          name,
          path: fullPath,
          isDirectory: true,
          children: await walk(fullPath, depth + 1),
        });
      } catch {
        // Skip.
      }
    }

    nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return nodes;
  }

  return walk(rootPath, 0);
}

export async function listMarkdown(rootPath: string): Promise<FileEntry[]> {
  const results: FileEntry[] = [];

  async function walk(dirPath: string): Promise<void> {
    let names: string[];
    try {
      names = await fs.readdir(dirPath);
    } catch {
      return;
    }

    for (const name of names) {
      if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
      const fullPath = path.join(dirPath, name);
      try {
        const info = await fs.stat(fullPath);
        if (info.isDirectory()) {
          await walk(fullPath);
        } else if (path.extname(name).toLowerCase() === ".md") {
          results.push(toEntry(fullPath, info));
        }
      } catch {
        // Skip.
      }
    }
  }

  await walk(rootPath);
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

export function joinPath(...parts: string[]): string {
  return path.join(...parts);
}

export function dirnamePath(filePath: string): string {
  return path.dirname(filePath);
}

export function basenamePath(filePath: string): string {
  return path.basename(filePath);
}

export function relativePath(fromPath: string, toPath: string): string {
  const relative = path.relative(fromPath, toPath);
  return relative.split(path.sep).join("/");
}

export async function createNote(dirPath: string, name?: string): Promise<string> {
  const base = (name?.trim() || "Untitled").replace(/[<>:"/\\|?*]/g, "").replace(/\.md$/i, "");
  let filePath = path.join(dirPath, `${base}.md`);
  let suffix = 1;

  while (await exists(filePath)) {
    suffix += 1;
    filePath = path.join(dirPath, `${base} ${suffix}.md`);
  }

  await writeText(filePath, `# ${path.basename(filePath, ".md")}\n\n`);
  return filePath;
}

export async function duplicate(targetPath: string): Promise<string> {
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let next = path.join(dir, `${base} copy${ext}`);
  let suffix = 2;

  while (await exists(next)) {
    next = path.join(dir, `${base} copy ${suffix}${ext}`);
    suffix += 1;
  }

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
