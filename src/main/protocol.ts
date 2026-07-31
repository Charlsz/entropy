import { app, nativeImage, protocol } from "electron";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const FILE_PROTOCOL = "entropy";

const THUMB_MAX_EDGE = 320;
const thumbJobs = new Map<string, Promise<{ body: Buffer; type: string }>>();
const PASS_THROUGH = new Set([".gif", ".svg"]);
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

export function registerFileProtocol(): void {
  protocol.handle(FILE_PROTOCOL, async (request) => {
    const thumbPrefix = `${FILE_PROTOCOL}://thumb/`;
    const localPrefix = `${FILE_PROTOCOL}://local/`;

    if (request.url.startsWith(thumbPrefix)) {
      const encoded = request.url.slice(thumbPrefix.length).split("?")[0] ?? "";
      const filePath = decodeURIComponent(encoded);
      try {
        const { body, type } = await getOrCreateThumb(filePath);
        return new Response(new Uint8Array(body), {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch {
        try {
          return await serveFile(filePath, request);
        } catch {
          return new Response("Not found", { status: 404 });
        }
      }
    }

    if (!request.url.startsWith(localPrefix)) {
      return new Response("Not found", { status: 404 });
    }

    const encoded = request.url.slice(localPrefix.length).split("?")[0] ?? "";
    const filePath = decodeURIComponent(encoded);
    try {
      return await serveFile(filePath, request);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

export function toEntropyUrl(filePath: string): string {
  return `${FILE_PROTOCOL}://local/${encodeURIComponent(filePath)}`;
}

export function toEntropyThumbUrl(filePath: string): string {
  return `${FILE_PROTOCOL}://thumb/${encodeURIComponent(filePath)}`;
}

/** Stream a local file with Range support (required for video seek / PDF viewers). */
async function serveFile(filePath: string, request: Request): Promise<Response> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) return new Response("Not found", { status: 404 });

  const size = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypeFor(ext) ?? "application/octet-stream";
  const rangeHeader = request.headers.get("Range") ?? request.headers.get("range");

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      return new Response("Invalid range", { status: 416 });
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      start >= size
    ) {
      return new Response("Invalid range", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const safeEnd = Math.min(end, size - 1);
    const chunkSize = safeEnd - start + 1;
    const nodeStream = createReadStream(filePath, { start, end: safeEnd });
    return new Response(Readable.toWeb(nodeStream) as any, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${safeEnd}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      },
    });
  }

  const nodeStream = createReadStream(filePath);
  return new Response(Readable.toWeb(nodeStream) as any, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    },
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
      // Prefer OS shell thumbnails for video/PDF (Windows/macOS).
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
          // Fall through to nativeImage / raw.
        }
      }

      const image = nativeImage.createFromPath(filePath);
      if (image.isEmpty()) {
        return { body: await fs.readFile(filePath), type: mimeFor(ext) };
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
