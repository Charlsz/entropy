import { app, nativeImage, net, protocol } from "electron";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FILE_PROTOCOL = "entropy";

const THUMB_MAX_EDGE = 320;
const thumbJobs = new Map<string, Promise<Buffer>>();

export function registerFileProtocol(): void {
  protocol.handle(FILE_PROTOCOL, async (request) => {
    const thumbPrefix = `${FILE_PROTOCOL}://thumb/`;
    const localPrefix = `${FILE_PROTOCOL}://local/`;

    if (request.url.startsWith(thumbPrefix)) {
      const encoded = request.url.slice(thumbPrefix.length).split("?")[0] ?? "";
      const filePath = decodeURIComponent(encoded);
      try {
        const body = await getOrCreateThumb(filePath);
        return new Response(new Uint8Array(body), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch {
        return new Response("Not found", { status: 404 });
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

async function getOrCreateThumb(filePath: string): Promise<Buffer> {
  const info = await fs.stat(filePath);
  const key = createHash("sha1")
    .update(`${filePath}|${Math.trunc(info.mtimeMs)}|${THUMB_MAX_EDGE}`)
    .digest("hex");
  const cachePath = path.join(app.getPath("userData"), "thumbs", `${key}.jpg`);

  try {
    return await fs.readFile(cachePath);
  } catch {
    // Generate below.
  }

  let job = thumbJobs.get(cachePath);
  if (!job) {
    job = (async () => {
      const image = nativeImage.createFromPath(filePath);
      if (image.isEmpty()) {
        throw new Error("Unable to decode image");
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
      return jpeg;
    })().finally(() => {
      thumbJobs.delete(cachePath);
    });
    thumbJobs.set(cachePath, job);
  }

  return job;
}
