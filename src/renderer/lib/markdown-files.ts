export interface MarkdownFileLink {
  label: string;
  href: string;
  raw: string;
  index: number;
}

const LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)/g;

function looksLikeFileHref(href: string): boolean {
  const value = href.trim();
  if (!value || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('#')) {
    return false;
  }

  if (value.startsWith('file:')) {
    return true;
  }

  if (value.startsWith('./') || value.startsWith('../')) {
    return true;
  }

  // Absolute Windows / POSIX paths or bare filenames with extensions
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || /\.[a-zA-Z0-9]{1,8}$/.test(value)) {
    return true;
  }

  return false;
}

export function extractFileLinks(markdown: string): MarkdownFileLink[] {
  const links: MarkdownFileLink[] = [];
  let match: RegExpExecArray | null;

  const re = new RegExp(LINK_RE.source, 'g');
  while ((match = re.exec(markdown)) !== null) {
    const label = match[1] ?? '';
    const href = match[2] ?? '';
    if (!looksLikeFileHref(href)) {
      continue;
    }

    links.push({
      label,
      href,
      raw: match[0],
      index: match.index
    });
  }

  return links;
}

export function insertAtCursor(source: string, insertion: string, cursor: number): { next: string; cursor: number } {
  const safeCursor = Math.max(0, Math.min(cursor, source.length));
  const before = source.slice(0, safeCursor);
  const after = source.slice(safeCursor);
  const needsLeadingNewline = before.length > 0 && !before.endsWith('\n') && !before.endsWith(' ');
  const chunk = `${needsLeadingNewline ? '\n' : ''}${insertion}`;
  return {
    next: `${before}${chunk}${after}`,
    cursor: before.length + chunk.length
  };
}

export function formatFileMarkdownLink(label: string, href: string): string {
  return `[${label}](${href})`;
}
