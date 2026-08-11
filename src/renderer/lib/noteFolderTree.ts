/** Parent directory of a note path (for “new note in this folder”). */
export function parentDirOfNote(notePath: string, workspaceRoot: string): string {
  const normalized = notePath.replace(/[/\\]+$/, "");
  const idxForward = normalized.lastIndexOf("/");
  const idxBack = normalized.lastIndexOf("\\");
  const idx = Math.max(idxForward, idxBack);
  if (idx <= 0) return workspaceRoot;
  const parent = normalized.slice(0, idx);
  // Windows drive root: "C:\\Note.md" → "C:" must become "C:\\".
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`;
  return parent || workspaceRoot;
}
