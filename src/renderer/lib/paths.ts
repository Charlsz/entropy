import {
  basenamePath,
  dirnamePath,
  joinPath,
  relativePath,
} from "../../shared/paths";
import { hostPlatform } from "./platform";

/** Path strings for the host OS. No IPC — these never touch the disk. */

export function join(...parts: string[]): string {
  return joinPath(hostPlatform(), ...parts);
}

export function dirname(filePath: string): string {
  return dirnamePath(hostPlatform(), filePath);
}

export function basename(filePath: string): string {
  return basenamePath(hostPlatform(), filePath);
}

export function relative(fromPath: string, toPath: string): string {
  return relativePath(hostPlatform(), fromPath, toPath);
}
