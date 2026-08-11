import type { FileEntry } from "../../shared/types";
import { parseMarkdownBlocks } from "./markdownBlocks";

export interface NoteFileReference {
  label: string;
  href: string;
}

/**
 * Local file references in note body (wiki, Markdown, HTML media) — line-level faces.
 * Shared by context usefulness + "In this note" list.
 */
export function listLocalFileReferences(content: string): NoteFileReference[] {
  const found: NoteFileReference[] = [];
  const seen = new Set<string>();

  for (const block of parseMarkdownBlocks(content)) {
    if (block.type === "media") {
      const key = block.src.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ label: block.alt || block.src, href: block.src });
      continue;
    }
    if (block.type === "fileRef") {
      const key = block.src.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ label: block.label || block.src, href: block.src });
    }
  }

  return found;
}

/** True when the Notebook context column would show something other than empty filler. */
export async function noteContextIsUseful(
  notePath: string | null,
  previewEntry: FileEntry | null | undefined,
  workspacePath: string,
  liveContent?: string | null,
): Promise<boolean> {
  if (previewEntry) return true;
  if (!notePath) return false;

  try {
    const content =
      liveContent != null ? liveContent : await window.entropy.fs.readText(notePath);
    if (listLocalFileReferences(content).length > 0) return true;
    const backlinks = await window.entropy.fs.findBacklinks(workspacePath, notePath);
    return backlinks.length > 0;
  } catch {
    return false;
  }
}
