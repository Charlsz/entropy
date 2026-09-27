/**
 * Whether a resolved markdown link points at a target file.
 * Basename equality is intentionally not enough — two different `photo.png`
 * files must not count as the same link.
 */

function pathKey(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function pathsMatchLink(resolvedPath: string, targetPath: string): boolean {
  const resolved = pathKey(resolvedPath);
  const target = pathKey(targetPath);
  if (!resolved || !target) return false;
  if (resolved === target) return true;
  if (resolved === `${target}.md`) return true;
  if (`${resolved}.md` === target) return true;
  return false;
}
