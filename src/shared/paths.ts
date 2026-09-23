/**
 * Host path strings without Node's `path` module, so the renderer can use them
 * under the sandbox. Behavior is checked against `node:path` in tests.
 */

function isWindows(platform: string): boolean {
  return platform === "win32";
}

function winNormalize(input: string): string {
  if (input.length === 0) return ".";
  const forwardOnly =
    !input.includes("\\") && !/^[A-Za-z]:/.test(input) && !input.startsWith("//");

  const trailing = /[\\/]$/.test(input);
  let prefix = "";
  let rest = input;

  const unc = /^[\\/]{2,}([^\\/]+)[\\/]+([^\\/]+)/.exec(input);
  if (unc) {
    prefix = `\\\\${unc[1]}\\${unc[2]}`;
    rest = input.slice(unc[0].length);
  } else if (/^[A-Za-z]:/.test(input)) {
    prefix = input.slice(0, 2);
    rest = input.slice(2);
  }

  const rooted = unc != null || rest.startsWith("\\") || rest.startsWith("/");
  const segments = rest.split(/[\\/]+/).filter((segment) => segment.length > 0 && segment !== ".");
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === "..") {
      if (stack.length > 0 && stack[stack.length - 1] !== "..") stack.pop();
      else if (!rooted && !unc) stack.push("..");
      continue;
    }
    stack.push(segment);
  }

  let body = stack.join("\\");
  if (rooted && !unc) {
    body = body.length > 0 ? `\\${body}` : "\\";
  } else if (unc) {
    body = body.length > 0 ? `\\${body}` : "";
  }

  let result = `${prefix}${body}`;
  if (result.length === 0) return ".";
  if (trailing && !/[\\/]$/.test(result)) result += "\\";
  // Drive root is `C:\`, not `C:`.
  if (/^[A-Za-z]:$/.test(result) && (rooted || trailing)) result += "\\";
  if (forwardOnly) return result.replace(/\\/g, "/");
  return result;
}

function posixNormalize(input: string): string {
  if (input.length === 0) return ".";
  const trailing = input.endsWith("/");
  const absolute = input.startsWith("/");
  const segments = input.split("/").filter((segment) => segment.length > 0 && segment !== ".");
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === "..") {
      if (stack.length > 0 && stack[stack.length - 1] !== "..") stack.pop();
      else if (!absolute) stack.push("..");
      continue;
    }
    stack.push(segment);
  }
  let result = `${absolute ? "/" : ""}${stack.join("/")}`;
  if (result.length === 0) return absolute ? "/" : ".";
  if (trailing && result !== "/" && !result.endsWith("/")) result += "/";
  return result;
}

function normalize(platform: string, input: string): string {
  return isWindows(platform) ? winNormalize(input) : posixNormalize(input);
}

export function joinPath(platform: string, ...parts: string[]): string {
  const filtered = parts.filter((part) => part.length > 0);
  if (filtered.length === 0) return ".";
  const sep = isWindows(platform) ? "\\" : "/";
  return normalize(platform, filtered.join(sep));
}

export function dirnamePath(platform: string, filePath: string): string {
  const normalized = normalize(platform, filePath);
  if (isWindows(platform)) {
    if (/^[A-Za-z]:\\$/.test(normalized) || /^[A-Za-z]:$/.test(normalized)) {
      return normalized;
    }
    if (/^\\\\[^\\]+\\[^\\]+\\?$/.test(normalized)) {
      return normalized.endsWith("\\") ? normalized : `${normalized}\\`;
    }
    const cut = normalized.replace(/[\\/]+$/, "");
    const index = Math.max(cut.lastIndexOf("\\"), cut.lastIndexOf("/"));
    if (index < 0) return ".";
    const parent = cut.slice(0, index);
    if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`;
    if (/^\\\\[^\\]+\\[^\\]+$/.test(parent)) return `${parent}\\`;
    return parent.length > 0 ? parent : "\\";
  }

  if (normalized === "/") return "/";
  const cut = normalized.replace(/\/+$/, "");
  const index = cut.lastIndexOf("/");
  if (index < 0) return ".";
  if (index === 0) return "/";
  return cut.slice(0, index);
}

export function basenamePath(platform: string, filePath: string): string {
  const normalized = normalize(platform, filePath).replace(/[\\/]+$/, "");
  const index = Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/"));
  const name = index >= 0 ? normalized.slice(index + 1) : normalized;
  if (isWindows(platform) && /^[A-Za-z]:$/.test(name)) return "";
  return name;
}

/**
 * Relative path using forward slashes.
 * Matches the previous main-process helper so note links stay portable.
 */
export function relativePath(platform: string, fromPath: string, toPath: string): string {
  const from = normalize(platform, fromPath).replace(/[\\/]+$/, "");
  const to = normalize(platform, toPath).replace(/[\\/]+$/, "");
  const sep = isWindows(platform) ? "\\" : "/";
  const fromParts = from.split(/[\\/]/).filter(Boolean);
  const toParts = to.split(/[\\/]/).filter(Boolean);

  if (isWindows(platform)) {
    const fromDrive = /^[A-Za-z]:$/.test(fromParts[0] ?? "") ? fromParts[0]!.toLowerCase() : "";
    const toDrive = /^[A-Za-z]:$/.test(toParts[0] ?? "") ? toParts[0]!.toLowerCase() : "";
    if (fromDrive !== toDrive) return to.split("\\").join("/");
    if (from.startsWith("\\\\") !== to.startsWith("\\\\")) return to.split("\\").join("/");
  } else if (from.startsWith("/") !== to.startsWith("/")) {
    return to;
  }

  let index = 0;
  const limit = Math.min(fromParts.length, toParts.length);
  while (index < limit) {
    const left = fromParts[index]!;
    const right = toParts[index]!;
    const same = isWindows(platform)
      ? left.toLowerCase() === right.toLowerCase()
      : left === right;
    if (!same) break;
    index += 1;
  }

  const up = fromParts.slice(index).map(() => "..");
  const down = toParts.slice(index);
  const relative = [...up, ...down].join(sep);
  return relative.split(sep).join("/");
}
