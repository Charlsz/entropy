/** Case-fold identity for caches and handle maps. Linux stays case-sensitive. */
export function pathIdentityKey(filePath: string, platform: string): string {
  const trimmed = filePath.replace(/[/\\]+$/, "");
  if (platform === "linux") return trimmed;
  return trimmed.toLowerCase();
}
