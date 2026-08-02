import { useEffect, useRef, useState } from "react";
import type { FileEntry } from "../../shared/types";
import { cn } from "../lib/utils";
import { isMediaReleasing, subscribeMediaRelease } from "../lib/mediaRelease";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".mkv", ".m4v"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".flac", ".aac"]);
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
  /** Compact thumbnail-style preview for side panels. */
  compact?: boolean;
}

export function FilePreview({ file, compact = false }: FilePreviewProps) {
  const kind = detectKind(file);
  const [url, setUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(() => isMediaReleasing(file.path));

  useEffect(() => {
    return subscribeMediaRelease(() => {
      setReleasing(isMediaReleasing(file.path));
    });
  }, [file.path]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      setText(null);
      setUrl(null);
      setThumbUrl(null);

      try {
        if (kind === "text") {
          const content = await window.entropy.fs.readText(file.path);
          if (!cancelled) setText(content.slice(0, 20_000));
        } else if (kind === "pdf" || kind === "video") {
          const [full, thumb] = await Promise.all([
            window.entropy.fs.toUrl(file.path),
            window.entropy.fs.toThumbUrl(file.path).catch(() => null),
          ]);
          if (!cancelled) {
            setUrl(full);
            setThumbUrl(thumb);
          }
        } else if (kind !== "unsupported") {
          const next = await window.entropy.fs.toUrl(file.path);
          if (!cancelled) setUrl(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Preview failed");
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
    return <p className="text-sm text-muted-foreground">Loading preview…</p>;
  }

  if (error) {
    return <p className="text-sm text-paper-2">{error}</p>;
  }

  if (kind === "unsupported") {
    return (
      <div className="rounded-lg border border-border bg-secondary p-3">
        <h3 className="text-sm font-medium">Preview unavailable</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Entropy can still manage this file, but no in-app preview is available for this type.
        </p>
      </div>
    );
  }

  const frame = cn(
    "file-preview overflow-hidden rounded-lg bg-ink-2",
    compact && "file-preview-compact max-h-40",
  );

  if (kind === "image" && url) {
    return (
      <div className={frame}>
        <img src={url} alt={file.name} className={compact ? "max-h-40 w-full object-cover" : undefined} />
      </div>
    );
  }

  if (kind === "pdf") {
    if (url) {
      const src = `${url}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`;
      return (
        <div className={cn(frame, "entropy-pdf-face", !compact && "min-h-[16rem]")}>
          <iframe
            title={file.name}
            src={src}
            className={cn(
              "entropy-pdf-face__frame border-0",
              compact ? "max-h-40 min-h-[8rem]" : "min-h-[16rem]",
            )}
          />
        </div>
      );
    }
    if (thumbUrl) {
      return (
        <div className={frame}>
          <img
            src={thumbUrl}
            alt={file.name}
            className={compact ? "max-h-40 w-full object-cover" : "w-full object-contain"}
          />
        </div>
      );
    }
  }

  if (kind === "video" && url && !releasing) {
    return (
      <div className={frame}>
        <VideoPlayer url={url} poster={thumbUrl} compact={compact} />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className={frame}>
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className={compact ? "max-h-40 w-full object-cover" : "h-full w-full object-cover"}
            draggable={false}
          />
        ) : (
          <p className="p-3 text-sm text-muted-foreground">Preview paused</p>
        )}
      </div>
    );
  }

  if (kind === "audio" && url) {
    return (
      <div className="rounded-lg border border-border bg-secondary p-3">
        <audio className="w-full" src={url} controls />
      </div>
    );
  }

  if (kind === "text" && text !== null) {
    return <pre className="file-preview file-preview-text">{text}</pre>;
  }

  return <p className="text-sm text-muted-foreground">Unable to preview this file.</p>;
}

function VideoPlayer({
  url,
  poster,
  compact,
}: {
  url: string;
  poster: string | null;
  compact: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!compact) return;
    const video = videoRef.current;
    if (!video) return;

    const CLIP_SECONDS = 4;
    let timer = 0;
    let cancelled = false;

    function clearTimer(): void {
      window.clearTimeout(timer);
      timer = 0;
    }

    async function playClip(): Promise<void> {
      const el = videoRef.current;
      if (!el || cancelled) return;
      try {
        el.currentTime = 0;
        await el.play();
        if (cancelled) return;
        clearTimer();
        timer = window.setTimeout(() => {
          if (!cancelled) void playClip();
        }, CLIP_SECONDS * 1000);
      } catch {
        // Keep poster when autoplay is blocked.
      }
    }

    function onLoaded(): void {
      void playClip();
    }

    video.addEventListener("loadeddata", onLoaded);
    if (video.readyState >= 2) onLoaded();

    return () => {
      cancelled = true;
      clearTimer();
      video.removeEventListener("loadeddata", onLoaded);
      video.pause();
    };
  }, [compact, url]);

  return (
    <video
      ref={videoRef}
      src={url}
      poster={poster ?? undefined}
      muted={compact}
      playsInline
      preload="metadata"
      controls={!compact}
      autoPlay={compact}
      className={cn("h-full w-full object-cover", compact && "max-h-40")}
    />
  );
}
