import {
  isLinux,
  isMac,
  isWindows,
  modKeyLabel,
  openTrashLabel,
  pathIsUnder,
  pathsEqual,
  revealInFolderLabel,
  trashDisplayName,
  type HostPlatform,
} from "../../shared/platform";

export type { HostPlatform };

/** Current host OS from preload (darwin | win32 | linux). */
export function hostPlatform(): HostPlatform {
  return window.entropy?.platform ?? "linux";
}

export function hostIsMac(): boolean {
  return isMac(hostPlatform());
}

export function hostIsWindows(): boolean {
  return isWindows(hostPlatform());
}

export function hostIsLinux(): boolean {
  return isLinux(hostPlatform());
}

export function samePath(a: string, b: string): boolean {
  return pathsEqual(a, b, hostPlatform());
}

export function isUnderPath(child: string, parent: string): boolean {
  return pathIsUnder(child, parent, hostPlatform());
}

export function osTrashName(): string {
  return trashDisplayName(hostPlatform());
}

export function osOpenTrashLabel(): string {
  return openTrashLabel(hostPlatform());
}

export function osRevealLabel(): string {
  return revealInFolderLabel(hostPlatform());
}

export function osModKey(): string {
  return modKeyLabel(hostPlatform());
}

export { isMac, isWindows, isLinux, trashDisplayName, revealInFolderLabel };
