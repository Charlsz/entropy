import { app, nativeImage, net, protocol } from "electron";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FILE_PROTOCOL = "entropy";

const THUMB_MAX_EDGE = 320;
const thumbJobs = new Map<string, Promise<{ body: Buffer; type: string }>>();
const PASS_THROUGH = new Set([".gif", ".svg"]);
const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".ico",
  ".tif",
  ".tiff",
  ".avif",
]);
const OS_THUMB_EXT = new Set([
  ".pdf",
  ".mp4",
  ".m4v",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
  ".wmv",
]);

function encodePathToken(filePath: string): string {
  return Buffer.from(filePath, "utf8").toString("base64url");
}

function decodePathToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    return decoded || null;
  } catch {
    return null;
  }
}

function filePathFromRequest(requestUrl: string, kind: "local" | "thumb"): string | null {
  try {
    const url = new URL(requestUrl);
    const fromQuery = url.searchParams.get("p") ?? url.searchParams.get("path");
    if (fromQuery) return fromQuery;

    const prefix = `${FILE_PROTOCOL}://${kind}/`;
    if (!requestUrl.startsWith(prefix)) return null;
    const encoded = requestUrl.slice(prefix.length).split("?")[0]?.split("#")[0] ?? "";
    if (!encoded) return null;

    // Preferred: base64url token (safe across Chromium URL normalization).
    if (!encoded.includes("%")) {
      const fromB64 = decodePathToken(encoded);
      if (fromB64) return fromB64;
    }

    // Legacy: encodeURIComponent(path) in the pathname.
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export function registerFileProtocol(): void {
  protocol.handle(FILE_PROTOCOL, async (request) => {
    const isThumb = request.url.startsWith(`${FILE_PROTOCOL}://thumb`);
    const filePath = filePathFromRequest(request.url, isThumb ? "thumb" : "local");
    if (!filePath) {
      return new Response("Not found", { status: 404 });
    }

    try {
      if (isThumb) {
        const { body, type } = await getOrCreateThumb(filePath);
        return new Response(new Uint8Array(body), {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
      return await serveFile(filePath, request);
    } catch {
      if (isThumb) {
        const ext = path.extname(filePath).toLowerCase();
        // Only fall back to raw bytes for real images — never PDF/video as a fake thumb.
        if (PASS_THROUGH.has(ext) || IMAGE_EXT.has(ext)) {
          try {
            return await serveFile(filePath, request);
          } catch {
            return new Response("Not found", { status: 404 });
          }
        }
      }
      return new Response("Not found", { status: 404 });
    }
  });
}

/** Base64url path token survives Chromium URL normalization on Windows paths. */
export function toEntropyUrl(filePath: string): string {
  return `${FILE_PROTOCOL}://local/${encodePathToken(filePath)}`;
}

export function toEntropyThumbUrl(filePath: string): string {
  return `${FILE_PROTOCOL}://thumb/${encodePathToken(filePath)}`;
}

/**
 * Serve a local file via Electron's file:// fetch so Range / PDF / video work
 * the same as opening the path on disk.
 */
async function serveFile(filePath: string, request: Request): Promise<Response> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  const range = request.headers.get("Range") ?? request.headers.get("range");
  if (range) headers.set("Range", range);

  const response = await net.fetch(pathToFileURL(filePath).href, { headers });
  if (!response.ok && response.status !== 206) {
    return new Response("Not found", { status: 404 });
  }

  // Ensure PDF/video MIME when the OS guess is wrong.
  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypeFor(ext);
  if (!type) return response;

  const outHeaders = new Headers(response.headers);
  outHeaders.set("Content-Type", type);
  outHeaders.set("Accept-Ranges", "bytes");
  outHeaders.set("Cache-Control", "no-cache");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
}

function contentTypeFor(ext: string): string | null {
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".ogg":
    case ".ogv":
      return "video/ogg";
    case ".mov":
      return "video/quicktime";
    case ".mkv":
      return "video/x-matroska";
    case ".avi":
      return "video/x-msvideo";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".flac":
      return "audio/flac";
    case ".aac":
      return "audio/aac";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    default:
      return null;
  }
}

function mimeFor(ext: string): string {
  switch (ext) {
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

async function getOrCreateThumb(filePath: string): Promise<{ body: Buffer; type: string }> {
  const ext = path.extname(filePath).toLowerCase();
  const info = await fs.stat(filePath);

  if (PASS_THROUGH.has(ext)) {
    return { body: await fs.readFile(filePath), type: mimeFor(ext) };
  }

  const key = createHash("sha1")
    .update(`${filePath}|${Math.trunc(info.mtimeMs)}|${THUMB_MAX_EDGE}`)
    .digest("hex");
  const cachePath = path.join(app.getPath("userData"), "thumbs", `${key}.jpg`);

  try {
    return { body: await fs.readFile(cachePath), type: "image/jpeg" };
  } catch {
    // Generate below.
  }

  let job = thumbJobs.get(cachePath);
  if (!job) {
    job = (async () => {
      if (OS_THUMB_EXT.has(ext)) {
        try {
          const osThumb = await nativeImage.createThumbnailFromPath(filePath, {
            width: THUMB_MAX_EDGE,
            height: THUMB_MAX_EDGE,
          });
          if (!osThumb.isEmpty()) {
            const jpeg = Buffer.from(osThumb.toJPEG(78));
            await fs.mkdir(path.dirname(cachePath), { recursive: true });
            await fs.writeFile(cachePath, jpeg);
            return { body: jpeg, type: "image/jpeg" };
          }
        } catch {
          // Fall through.
        }
      }

      // Never return raw PDF/video bytes as a fake JPEG — callers can use the file URL instead.
      if (ext === ".pdf" || OS_THUMB_EXT.has(ext)) {
        throw new Error(`No thumbnail for ${ext}`);
      }

      const image = nativeImage.createFromPath(filePath);
      if (image.isEmpty()) {
        throw new Error("Empty image");
      }

      const size = image.getSize();
      const longest = Math.max(size.width, size.height) || 1;
      const scale = Math.min(1, THUMB_MAX_EDGE / longest);
      const resized =
        scale < 1
          ? image.resize({
              width: Math.max(1, Math.round(size.width * scale)),
              height: Math.max(1, Math.round(size.height * scale)),
              quality: "better",
            })
          : image;

      const jpeg = Buffer.from(resized.toJPEG(78));
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, jpeg);
      return { body: jpeg, type: "image/jpeg" };
    })().finally(() => {
      thumbJobs.delete(cachePath);
    });
    thumbJobs.set(cachePath, job);
  }

  return job;
}
