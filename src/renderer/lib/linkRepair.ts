/** Escape a path for use inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrite or remove a markdown href (image or link) while keeping writing calm.
 * `to === null` removes the image entirely, or unwraps a text link to its label.
 * Matches both bare and `<angle-bracket>` href forms.
 */
export function rewriteMarkdownHref(markdown: string, from: string, to: string | null): string {
  const esc = escapeRegExp(from);
  const target = `(?:${esc}|<${esc}>)`;
  if (to === null) {
    let next = markdown.replace(new RegExp(`!\\[[^\\]]*\\]\\(${target}\\)`, "g"), "");
    next = next.replace(new RegExp(`\\[([^\\]]*)\\]\\(${target}\\)`, "g"), "$1");
    return next.replace(/\n{3,}/g, "\n\n");
  }
  return markdown.replace(new RegExp(`(\\[[^\\]]*\\]\\()${target}(\\))`, "g"), `$1${to}$2`);
}
