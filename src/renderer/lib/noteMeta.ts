const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface NoteFrontmatter {
  cover: string | null;
  body: string;
}

/** Parse a minimal YAML-like frontmatter block for cover/banner/image. */
export function parseNoteFrontmatter(content: string): NoteFrontmatter {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    return { cover: null, body: content };
  }

  let cover: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^\s*(cover|banner|image)\s*:\s*(.+?)\s*$/i.exec(line);
    if (!pair) continue;
    let value = pair[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) {
      cover = value;
      break;
    }
  }

  return {
    cover,
    body: content.slice(match[0].length),
  };
}
