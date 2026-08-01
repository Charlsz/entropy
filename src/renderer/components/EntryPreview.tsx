import { memo, useEffect, useRef, useState } from "react";
import { FileText, Folder } from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { useInView } from "../hooks/useInView";
import { isMediaEntry, mediaKind } from "../lib/media";
import { getFileUrl, getThumbUrl } from "../lib/urlCache";
import { withVideoSlot } from "../lib/videoSlot";
import { createSlot } from "../lib/asyncSlot";
import { cn } from "../lib/utils";

const VIDEO_CLIP_SECONDS = 4;

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
  size?: "sm" | "md" | "lg";
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
    size === "sm" && "h-7 w-7 shrink-0 rounded",
    size === "md" && "h-10 w-10 shrink-0 rounded-md",
    size === "lg" && "aspect-square w-full rounded-xl",
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
  if (kind === "image" || kind === "video" || kind === "pdf") {
    return (
      <div ref={ref} className={shell}>
        {inView ? (
          kind === "image" ? (
            <ImageThumb path={entry.path} alt={entry.name} />
          ) : kind === "video" ? (
            <VideoThumb path={entry.path} size={size} />
          ) : (
            <PdfThumb path={entry.path} size={size} />
          )
        ) : (
          <QuietFace />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn(shell, "flex items-center justify-center")}>
      {size === "lg" ? (
        <FileText className="h-6 w-6 text-muted-foreground/70" strokeWidth={1.25} />
      ) : (
        <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
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

function FolderCollage({ path, size }: { path: string; size: "sm" | "md" | "lg" }) {
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
  if (data.media.length === 0) return size === "lg" ? <FolderFallback /> : <QuietFace />;

  if (size === "sm" || size === "md") {
    const first = data.media[0];
    return mediaKind(first.extension) === "video" ? (
      <VideoThumb path={first.path} size={size} />
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
    }, () => cancelled);
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

function PdfThumb({ path, size }: { path: string; size: "sm" | "md" | "lg" }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setThumbUrl(null);
    setFileUrl(null);
    void withImageSlot(async () => {
      try {
        const [thumb, file] = await Promise.all([
          getThumbUrl(path).catch(() => null),
          getFileUrl(path).catch(() => null),
        ]);
        if (cancelled) return;
        if (thumb) setThumbUrl(thumb);
        if (file) setFileUrl(file);
        if (!thumb && !file) setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-ink-2">
        <FileText className="h-6 w-6 text-muted-foreground/70" strokeWidth={1.25} />
        {size === "lg" ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            PDF
          </span>
        ) : null}
      </div>
    );
  }

  // Live first page via file URL — OS PDF thumbs are unreliable on Windows.
  if (fileUrl) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-ink-2">
        <iframe
          title="PDF preview"
          src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`}
          className="pointer-events-none h-[140%] w-full border-0 bg-ink-2"
          tabIndex={-1}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-paper-2">PDF</span>
        </div>
      </div>
    );
  }

  if (!thumbUrl) return <QuietFace />;

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-2">
      <img
        src={thumbUrl}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-paper-2">PDF</span>
      </div>
    </div>
  );
}

function VideoThumb({ path, size }: { path: string; size: "sm" | "md" | "lg" }) {
  const [url, setUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUrl(null);
    setPoster(null);
    void withVideoSlot(async () => {
      try {
        const [fileUrl, thumb] = await Promise.all([
          getFileUrl(path),
          getThumbUrl(path).catch(() => null),
        ]);
        if (!cancelled) {
          setUrl(fileUrl);
          setPoster(thumb);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

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
        }, VIDEO_CLIP_SECONDS * 1000);
      } catch {
        // Keep poster frame when autoplay is blocked.
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
  }, [url]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ink-2">
        <FileText
          className={cn(
            "text-muted-foreground/70",
            size === "lg" ? "h-6 w-6" : "h-3.5 w-3.5",
          )}
          strokeWidth={1.25}
        />
      </div>
    );
  }

  if (!url) return <QuietFace />;

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-2">
      <video
        ref={videoRef}
        src={url}
        poster={poster ?? undefined}
        muted
        playsInline
        preload="metadata"
        draggable={false}
        className="h-full w-full object-cover"
      />
    </div>
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
