import type { FileEntry } from "../../shared/types";

const LINK_RE = /\!?\[([^\]]*)\]\((<[^>]+>|[^)\s]+)\)/g;

function normalizeHref(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed.slice(1, -1);
  return trimmed;
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
    LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK_RE.exec(content)) !== null) {
      const href = normalizeHref(match[2]);
      if (/^(https?:|mailto:|data:)/i.test(href)) continue;
      return true;
    }
    const backlinks = await window.entropy.fs.findBacklinks(workspacePath, notePath);
    return backlinks.length > 0;
  } catch {
    return false;
  }
}
