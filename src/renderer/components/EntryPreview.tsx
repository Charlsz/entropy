import { memo, useEffect, useRef, useState } from "react";
import { FileText, Folder } from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { useInView } from "../hooks/useInView";
import { isMediaEntry, mediaKind } from "../lib/media";
import { getFileUrl, getThumbUrl } from "../lib/urlCache";
import { withVideoSlot } from "../lib/videoSlot";
import { createSlot } from "../lib/asyncSlot";
import { cn } from "../lib/utils";

export interface FolderPreviewData {
  media: FileEntry[];
  count: number;
}

const folderPreviewCache = new Map<string, Promise<FolderPreviewData>>();
const withFolderSlot = createSlot(3);
const withImageSlot = createSlot(6);

export function getFolderPreview(folderPath: string): Promise<FolderPreviewData> {
  let pending = folderPreviewCache.get(folderPath);
  if (!pending) {
    pending = withFolderSlot(() =>
      window.entropy.fs
        .listDir(folderPath)
        .then((entries) => ({
          media: entries.filter(isMediaEntry).slice(0, 4),
          count: entries.length,
        }))
        .catch(() => ({ media: [] as FileEntry[], count: 0 })),
    );
    folderPreviewCache.set(folderPath, pending);
  }
  return pending;
}

interface EntryPreviewProps {
  entry: FileEntry;
  size?: "sm" | "lg";
  className?: string;
}

export const EntryPreview = memo(function EntryPreview({
  entry,
  size = "sm",
  className,
}: EntryPreviewProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const shell = cn(
    "relative overflow-hidden bg-ink-2",
    size === "sm" ? "h-8 w-8 shrink-0 rounded" : "aspect-square w-full rounded-xl",
    className,
  );

  if (entry.isDirectory) {
    return (
      <div ref={ref} className={shell}>
        {inView ? <FolderCollage path={entry.path} size={size} /> : <QuietFace />}
      </div>
    );
  }

  const kind = mediaKind(entry.extension);
  if (kind === "image" || kind === "video") {
    return (
      <div ref={ref} className={shell}>
        {inView ? (
          kind === "image" ? (
            <ImageThumb path={entry.path} alt={entry.name} />
          ) : (
            <VideoThumb path={entry.path} size={size} />
          )
        ) : (
          <QuietFace />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn(shell, "flex items-center justify-center")}>
      {size === "sm" ? (
        <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
      ) : (
        <FileText className="h-6 w-6 text-muted-foreground/70" strokeWidth={1.25} />
      )}
    </div>
  );
});

function QuietFace() {
  return <div className="h-full w-full bg-ink-2" />;
}

function FolderFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-ink-2">
      <Folder className="h-7 w-7 text-muted-foreground/60" strokeWidth={1.25} />
    </div>
  );
}

function FolderCollage({ path, size }: { path: string; size: "sm" | "lg" }) {
  const [data, setData] = useState<FolderPreviewData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getFolderPreview(path).then((next) => {
      if (!cancelled) setData(next);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!data) return <QuietFace />;
  if (data.media.length === 0) return size === "sm" ? <QuietFace /> : <FolderFallback />;

  if (size === "sm") {
    const first = data.media[0];
    return mediaKind(first.extension) === "video" ? (
      <VideoThumb path={first.path} size="sm" />
    ) : (
      <ImageThumb path={first.path} alt={first.name} />
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[1px] bg-ink">
      {Array.from({ length: 4 }).map((_, index) => {
        const item = data.media[index];
        if (!item) {
          return <div key={index} className="bg-ink-2" />;
        }
        return (
          <div key={item.path} className="relative overflow-hidden bg-ink-2">
            {mediaKind(item.extension) === "video" ? (
              <VideoThumb path={item.path} size="sm" />
            ) : (
              <ImageThumb path={item.path} alt={item.name} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImageThumb({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void withImageSlot(async () => {
      const next = await getThumbUrl(path);
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) return <QuietFace />;

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className="h-full w-full object-cover"
    />
  );
}

const VIDEO_PREVIEW_SECONDS = 3;

function VideoThumb({ path, size }: { path: string; size: "sm" | "lg" }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void withVideoSlot(async () => {
      const next = await getFileUrl(path);
      if (!cancelled) setUrl(next);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    function onLoaded(): void {
      const el = videoRef.current;
      if (!el) return;
      try {
        el.currentTime = 0.05;
      } catch {
        // Ignore seek failures.
      }
    }

    function onSeeked(): void {
      videoRef.current?.pause();
    }

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [url]);

  async function playPreview(): Promise<void> {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.currentTime = 0;
      await video.play();
      window.setTimeout(() => {
        if (videoRef.current === video) {
          video.pause();
          video.currentTime = 0.05;
        }
      }, VIDEO_PREVIEW_SECONDS * 1000);
    } catch {
      // Keep still frame.
    }
  }

  function stopPreview(): void {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    try {
      video.currentTime = 0.05;
    } catch {
      // Ignore.
    }
  }

  if (!url) return <QuietFace />;

  return (
    <video
      ref={videoRef}
      src={url}
      muted
      playsInline
      preload="metadata"
      draggable={false}
      className="h-full w-full object-cover"
      onMouseEnter={size === "lg" ? () => void playPreview() : undefined}
      onMouseLeave={size === "lg" ? stopPreview : undefined}
    />
  );
}

/** Folder item count for Refern-style labels. Lazy + cached. */
export function useFolderCount(path: string, enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void getFolderPreview(path).then((data) => {
      if (!cancelled) setCount(data.count);
    });
    return () => {
      cancelled = true;
    };
  }, [path, enabled]);

  return count;
}
