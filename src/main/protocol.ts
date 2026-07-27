import { net, protocol } from "electron";
import { pathToFileURL } from "node:url";

export const FILE_PROTOCOL = "entropy";

export function registerFileProtocol(): void {
  protocol.handle(FILE_PROTOCOL, (request) => {
    const prefix = `${FILE_PROTOCOL}://local/`;
    if (!request.url.startsWith(prefix)) {
      return new Response("Not found", { status: 404 });
    }

    const encoded = request.url.slice(prefix.length);
    const filePath = decodeURIComponent(encoded);
    return net.fetch(pathToFileURL(filePath).href);
  });
}

export function toEntropyUrl(filePath: string): string {
  return `${FILE_PROTOCOL}://local/${encodeURIComponent(filePath)}`;
}
