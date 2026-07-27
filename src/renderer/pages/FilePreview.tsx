import { useEffect, useState } from "react";
import type { FileEntry } from "../../shared/types";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".mkv"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]);
const TEXT_EXT = new Set([
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".html",
  ".xml",
  ".yml",
  ".yaml",
  ".toml",
  ".ini",
  ".log",
]);

type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "unsupported";

function detectKind(entry: FileEntry): PreviewKind {
  const ext = entry.extension.toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (TEXT_EXT.has(ext)) return "text";
  return "unsupported";
}

interface FilePreviewProps {
  file: FileEntry;
}

export function FilePreview({ file }: FilePreviewProps) {
  const kind = detectKind(file);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      setText(null);
      setUrl(null);

      try {
        if (kind === "text") {
          const content = await window.entropy.fs.readText(file.path);
          if (!cancelled) setText(content);
        } else if (kind !== "unsupported") {
          const nextUrl = await window.entropy.fs.toUrl(file.path);
          if (!cancelled) setUrl(nextUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load preview");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [file.path, kind]);

  if (loading) {
    return <p className="pane-empty">Loading preview…</p>;
  }

  if (error) {
    return <p className="inline-error">{error}</p>;
  }

  if (kind === "unsupported") {
    return (
      <div className="preview-unsupported">
        <h3>Preview unavailable</h3>
        <p>Entropy can still manage this file, but no in-app preview is available for this type.</p>
      </div>
    );
  }

  if (kind === "image" && url) {
    return (
      <div className="preview-media">
        <img src={url} alt={file.name} />
      </div>
    );
  }

  if (kind === "pdf" && url) {
    return (
      <div className="preview-frame">
        <iframe title={file.name} src={url} />
      </div>
    );
  }

  if (kind === "video" && url) {
    return (
      <div className="preview-media">
        <video src={url} controls />
      </div>
    );
  }

  if (kind === "audio" && url) {
    return (
      <div className="preview-audio">
        <audio src={url} controls />
      </div>
    );
  }

  if (kind === "text" && text !== null) {
    return (
      <pre className="preview-text">{text}</pre>
    );
  }

  return <p className="pane-empty">Unable to preview this file.</p>;
}
