import { app, nativeImage, net, protocol } from "electron";
import { createHash } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

export const FILE_PROTOCOL = "entropy";

const THUMB_MAX_EDGE = 320;
const THUMB_CONCURRENCY = 4;
const thumbJobs = new Map<string, Promise<{ body: Buffer; type: string }>>();
let thumbActive = 0;
const thumbWaiters: Array<() => void> = [];
/** Live Node readers for entropy:// responses — destroyed before trash so Windows unlocks. */
const activeReaders = new Map<string, Set<ReadStream>>();

function readerKey(filePath: string): string {
  return path.normalize(filePath);
}

function trackReader(filePath: string, stream: ReadStream): void {
  const key = readerKey(filePath);
  let set = activeReaders.get(key);
  if (!set) {
    set = new Set();
    activeReaders.set(key, set);
  }
  set.add(stream);
  const drop = (): void => {
    set?.delete(stream);
    if (set && set.size === 0) activeReaders.delete(key);
  };
  stream.once("close", drop);
  stream.once("error", drop);
}

/** Abort any in-flight entropy:// body streams for this path (drops Windows share locks). */
export async function releaseFileReaders(filePath: string): Promise<void> {
  const key = readerKey(filePath);
  const set = activeReaders.get(key);
  if (set) {
    for (const stream of [...set]) {
      try {
        stream.destroy();
      } catch {
        // Ignore.
      }
    }
    activeReaders.delete(key);
  }
  // Brief settle so the OS releases the last HANDLE.
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function withThumbSlot<T>(task: () => Promise<T>): Promise<T> {
  if (thumbActive >= THUMB_CONCURRENCY) {
    await new Promise<void>((resolve) => thumbWaiters.push(resolve));
  }
  thumbActive += 1;
  try {
    return await task();
  } finally {
    thumbActive -= 1;
    const next = thumbWaiters.shift();
    if (next) next();
  }
}
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
 * Serve local files with short-lived Node reads (not Chromium net.fetch(file://)).
 * file:// fetches leave Windows share locks that block Recycle Bin until the app quits.
 *
 * Exception: video/audio/PDF need Chromium's Range pipeline for video/audio/PDF elements.
 * DOM unload + releaseFileReaders before trash clears those handles.
 */
async function serveFile(filePath: string, request: Request): Promise<Response> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) return new Response("Not found", { status: 404 });

  const size = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypeFor(ext) ?? "application/octet-stream";
  const isAv =
    type.startsWith("video/") || type.startsWith("audio/") || type === "application/pdf";

  // Media/PDF: prefer Chromium file:// fetch so Range seeks work in <video>/PDF.
  if (isAv) {
    const headers = new Headers();
    const range = request.headers.get("Range") ?? request.headers.get("range");
    if (range) headers.set("Range", range);
    const response = await net.fetch(pathToFileURL(filePath).href, { headers });
    if (!response.ok && response.status !== 206) {
      return new Response("Not found", { status: 404 });
    }
    const outHeaders = new Headers(response.headers);
    outHeaders.set("Content-Type", type);
    outHeaders.set("Accept-Ranges", "bytes");
    outHeaders.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  }

  // Images / small blobs: one-shot read so the FD is gone before the Response settles.
  if (size <= 32 * 1024 * 1024) {
    const body = await fs.readFile(filePath);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(body.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  }

  let start = 0;
  let end = size - 1;
  let status = 200;
  const rangeHeader = request.headers.get("Range") ?? request.headers.get("range");
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (match) {
      if (match[1] !== "") start = Number(match[1]);
      if (match[2] !== "") end = Number(match[2]);
      if (!Number.isFinite(start) || start < 0) start = 0;
      if (!Number.isFinite(end) || end < 0 || end >= size) end = size - 1;
      if (start >= size || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      status = 206;
    }
  }

  const stream = createReadStream(filePath, {
    start,
    end,
    autoClose: true,
    emitClose: true,
  });
  trackReader(filePath, stream);

  const abort = (): void => {
    stream.destroy();
  };
  if (request.signal?.aborted) {
    abort();
    return new Response(null, { status: 499 });
  }
  request.signal?.addEventListener("abort", abort, { once: true });
  stream.once("close", () => {
    request.signal?.removeEventListener("abort", abort);
  });

  const headers = new Headers({
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1),
    "Cache-Control": "no-store",
  });
  if (status === 206) {
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status,
    headers,
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
    job = withThumbSlot(async () => {
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
    }).finally(() => {
      thumbJobs.delete(cachePath);
    });
    thumbJobs.set(cachePath, job);
  }

  return job;
}
