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

/** Legacy Windows profile junctions that often raise EPERM when scanned. */
const WINDOWS_PROFILE_ALIASES = new Set([
  "application data",
  "cookies",
  "local settings",
  "my documents",
  "my music",
  "my pictures",
  "my videos",
  "nethood",
  "printhood",
  "recent",
  "sendto",
  "start menu",
  "templates",
]);

function shouldSkipDirName(name: string): boolean {
  if (SKIP_DIRS.has(name) || name.startsWith(".")) return true;
  if (process.platform === "win32" && WINDOWS_PROFILE_ALIASES.has(name.toLowerCase())) {
    return true;
  }
  return false;
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
          // Prefer lstat so Windows junctions are visible as links.
          const linkInfo = await fs.lstat(fullPath);
          if (linkInfo.isSymbolicLink() && (dirent.isDirectory() || linkInfo.isDirectory())) {
            // Skip inaccessible profile junctions; keep intentional user symlinks that resolve.
            try {
              await fs.access(fullPath);
              const target = await fs.stat(fullPath);
              if (!target.isDirectory()) return toEntry(fullPath, target);
              // Still hide known Windows aliases even if access somehow succeeds.
              if (shouldSkipDirName(dirent.name)) return null;
              return toEntry(fullPath, target);
            } catch {
              return null;
            }
          }
          const info = linkInfo.isDirectory() || linkInfo.isFile() ? linkInfo : await fs.stat(fullPath);
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
