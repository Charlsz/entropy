import { app, nativeImage, net, protocol } from "electron";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FILE_PROTOCOL = "entropy";

const THUMB_MAX_EDGE = 320;
const thumbJobs = new Map<string, Promise<{ body: Buffer; type: string }>>();
const PASS_THROUGH = new Set([".gif", ".svg"]);

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
        // Last resort: stream original so GIF/odd formats still preview.
        try {
          return await net.fetch(pathToFileURL(filePath).href);
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
    return net.fetch(pathToFileURL(filePath).href);
  });
}

export function toEntropyUrl(filePath: string): string {
  return `${FILE_PROTOCOL}://local/${encodeURIComponent(filePath)}`;
}

export function toEntropyThumbUrl(filePath: string): string {
  return `${FILE_PROTOCOL}://thumb/${encodeURIComponent(filePath)}`;
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

  // Animated / vector formats: serve original bytes (nativeImage often fails on GIF).
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
      const image = nativeImage.createFromPath(filePath);
      if (image.isEmpty()) {
        // Fallback to original file bytes.
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
