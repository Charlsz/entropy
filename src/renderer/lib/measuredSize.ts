import { pathIdentityKey } from "../../shared/pathIdentity";

/** Folder recursive sizes keyed by the path the measure pass returned. */
export function lookupMeasuredSize(
  sizeByPath: Record<string, number>,
  entryPath: string,
  platform: string,
): number | undefined {
  const direct = sizeByPath[entryPath];
  if (direct !== undefined) return direct;

  const want = pathIdentityKey(entryPath, platform);
  for (const [key, size] of Object.entries(sizeByPath)) {
    if (pathIdentityKey(key, platform) === want) return size;
  }
  return undefined;
}
