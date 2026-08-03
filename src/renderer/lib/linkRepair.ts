/** Escape a path for use inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrite or remove a markdown / Obsidian wiki href while keeping writing calm.
 * `to === null` removes the embed entirely, or unwraps a text link to its label.
 * Matches bare, `<angle-bracket>`, and `![[target]]` / `![[target|alias]]` forms.
 */
export function rewriteMarkdownHref(markdown: string, from: string, to: string | null): string {
  const esc = escapeRegExp(from);
  const target = `(?:${esc}|<${esc}>)`;
  if (to === null) {
    let next = markdown.replace(new RegExp(`!\\[[^\\]]*\\]\\(${target}\\)`, "g"), "");
    next = next.replace(new RegExp(`!\\[\\[${esc}(?:\\|[^\\]]*)?\\]\\]`, "g"), "");
    next = next.replace(new RegExp(`\\[([^\\]]*)\\]\\(${target}\\)`, "g"), "$1");
    return next.replace(/\n{3,}/g, "\n\n");
  }

  const wikiTo = to.startsWith("<") && to.endsWith(">") ? to.slice(1, -1) : to;
  let next = markdown.replace(new RegExp(`(\\[[^\\]]*\\]\\()${target}(\\))`, "g"), `$1${to}$2`);
  next = next.replace(
    new RegExp(`(!\\[\\[)${esc}((?:\\|[^\\]]*)?\\]\\])`, "g"),
    `$1${wikiTo}$2`,
  );
  return next;
}
