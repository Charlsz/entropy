import { memo, useEffect, useRef, useState } from "react";
import { FileText, Folder } from "lucide-react";
import type { FileEntry } from "../../shared/types";
import { useInView } from "../hooks/useInView";
import { isMediaEntry, mediaKind } from "../lib/media";
import { getFileUrl, getThumbUrl } from "../lib/urlCache";
import { withVideoSlot } from "../lib/videoSlot";
import { isMediaReleasing, subscribeMediaRelease } from "../lib/mediaRelease";
import { createSlot } from "../lib/asyncSlot";
import { cn } from "../lib/utils";

const VIDEO_CLIP_SECONDS = 4;

export interface FolderPreviewData {
  media: FileEntry[];
  count: number;
}

const folderPreviewCache = new Map<string, Promise<FolderPreviewData>>();
const FOLDER_PREVIEW_CACHE_MAX = 80;
const withFolderSlot = createSlot(4);
const withImageSlot = createSlot(8);

export function getFolderPreview(folderPath: string): Promise<FolderPreviewData> {
  const cacheKey = `v3:${folderPath}`;
  let pending = folderPreviewCache.get(cacheKey);
  if (!pending) {
    pending = withFolderSlot(async () => {
      try {
        const entries = await window.entropy.fs.listDir(folderPath);
        const media = await sampleFolderMediaFromListing(folderPath, entries, 4);
        return { media, count: entries.length };
      } catch {
        return { media: [] as FileEntry[], count: 0 };
      }
    });
    folderPreviewCache.set(cacheKey, pending);
    while (folderPreviewCache.size > FOLDER_PREVIEW_CACHE_MAX) {
      const oldest = folderPreviewCache.keys().next().value;
      if (oldest === undefined) break;
      folderPreviewCache.delete(oldest);
    }
  }
  return pending;
}

/** Direct media first, then one level of subfolders — enough for a collage without deep crawls. */
async function sampleFolderMediaFromListing(
  _folderPath: string,
  entries: FileEntry[],
  limit: number,
): Promise<FileEntry[]> {
  const picked: FileEntry[] = [];
  const seen = new Set<string>();

  const push = (entry: FileEntry): boolean => {
    const key = entry.path.replace(/\\/g, "/").toLowerCase();
    if (seen.has(key)) return picked.length >= limit;
    seen.add(key);
    picked.push(entry);
    return picked.length >= limit;
  };

  const dirs: FileEntry[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      dirs.push(entry);
      continue;
    }
    if (isMediaEntry(entry) && push(entry)) return picked;
  }

  if (picked.length < limit) {
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (mediaKind(entry.extension) === "pdf" && push(entry)) return picked;
    }
  }

  for (const dir of dirs.slice(0, 6)) {
    if (picked.length >= limit) break;
    try {
      const nested = await window.entropy.fs.listDir(dir.path);
      for (const entry of nested) {
        if (isMediaEntry(entry) && push(entry)) return picked;
      }
      if (picked.length >= limit) return picked;
      for (const entry of nested) {
        if (!entry.isDirectory && mediaKind(entry.extension) === "pdf" && push(entry)) {
          return picked;
        }
      }
    } catch {
      // Skip unreadable children.
    }
  }

  return picked;
}

/** Drop cached folder collages after an external directory change. */
export function invalidateFolderPreview(folderPath?: string): void {
  if (!folderPath) {
    folderPreviewCache.clear();
    return;
  }
  const needle = folderPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  for (const key of [...folderPreviewCache.keys()]) {
    const bare = key.replace(/^v\d+:/, "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    if (bare === needle || bare.startsWith(`${needle}/`)) {
      folderPreviewCache.delete(key);
    }
  }
}

interface EntryPreviewProps {
  entry: FileEntry;
  size?: "sm" | "md" | "lg";
  /** cover crops for grid faces; contain keeps full media in inspector. */
  fit?: "cover" | "contain";
  className?: string;
}

export const EntryPreview = memo(function EntryPreview({
  entry,
  size = "sm",
  fit = "cover",
  className,
}: EntryPreviewProps) {
  const { ref, inView } = useInView<HTMLDivElement>("160px");
  const shell = cn(
    "relative overflow-hidden bg-ink-2",
    size === "sm" && "h-7 w-7 shrink-0 rounded",
    size === "md" && "h-10 w-10 shrink-0 rounded-md",
    size === "lg" && "aspect-square w-full rounded-xl",
    className,
  );
  const objectFit = fit === "contain" ? "object-contain" : "object-cover";

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
            <ImageThumb path={entry.path} alt={entry.name} objectFit={objectFit} />
          ) : kind === "video" ? (
            <VideoThumb
              path={entry.path}
              size={size}
              objectFit={objectFit}
              autoplay={fit === "contain" && size === "lg"}
            />
          ) : (
            <PdfThumb path={entry.path} size={size} objectFit={objectFit} />
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
    return <FolderMediaCell entry={first} />;
  }

  const items = data.media.slice(0, 4);
  const count = items.length;

  if (count === 1) {
    return (
      <div className="h-full w-full overflow-hidden bg-ink-2">
        <FolderMediaCell entry={items[0]} />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-[1px] bg-ink">
        {items.map((item) => (
          <div key={item.path} className="relative min-h-0 overflow-hidden bg-ink-2">
            <FolderMediaCell entry={item} />
          </div>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[1px] bg-ink">
        <div className="relative row-span-2 min-h-0 overflow-hidden bg-ink-2">
          <FolderMediaCell entry={items[0]} />
        </div>
        <div className="relative min-h-0 overflow-hidden bg-ink-2">
          <FolderMediaCell entry={items[1]} />
        </div>
        <div className="relative min-h-0 overflow-hidden bg-ink-2">
          <FolderMediaCell entry={items[2]} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[1px] bg-ink">
      {items.map((item) => (
        <div key={item.path} className="relative min-h-0 overflow-hidden bg-ink-2">
          <FolderMediaCell entry={item} />
        </div>
      ))}
    </div>
  );
}

function FolderMediaCell({ entry }: { entry: FileEntry }) {
  const kind = mediaKind(entry.extension);
  if (kind === "video") return <VideoThumb path={entry.path} size="sm" />;
  if (kind === "pdf") return <PdfThumb path={entry.path} size="sm" />;
  return <ImageThumb path={entry.path} alt={entry.name} />;
}

function ImageThumb({
  path,
  alt,
  objectFit = "object-cover",
}: {
  path: string;
  alt: string;
  objectFit?: string;
}) {
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
      className={cn("h-full w-full", objectFit)}
    />
  );
}

function PdfThumb({
  path,
  size,
  objectFit = "object-cover",
}: {
  path: string;
  size: "sm" | "md" | "lg";
  objectFit?: string;
}) {
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
        const thumb = await getThumbUrl(path).catch(() => null);
        if (cancelled) return;
        if (thumb) {
          setThumbUrl(thumb);
          return;
        }
        // Full PDF fetch only when OS thumb is unavailable.
        const file = await getFileUrl(path).catch(() => null);
        if (cancelled) return;
        if (file) setFileUrl(file);
        else setFailed(true);
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

  // Prefer OS/generated thumb in the gallery — full PDF iframes are expensive.
  if (thumbUrl) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-ink-2">
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn("h-full w-full", objectFit)}
          onError={() => {
            setThumbUrl(null);
            void getFileUrl(path)
              .then((file) => {
                if (file) setFileUrl(file);
                else setFailed(true);
              })
              .catch(() => setFailed(true));
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-paper-2">PDF</span>
        </div>
      </div>
    );
  }

  if (fileUrl) {
    return (
      <div className="entropy-pdf-face relative h-full w-full overflow-hidden bg-ink-2">
        <iframe
          title="PDF preview"
          src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`}
          className="entropy-pdf-face__frame pointer-events-none border-0 bg-ink-2"
          tabIndex={-1}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-paper-2">PDF</span>
        </div>
      </div>
    );
  }

  return <QuietFace />;
}

function unloadVideoEl(video: HTMLVideoElement | null): void {
  if (!video) return;
  try {
    video.pause();
  } catch {
    // Ignore.
  }
  try {
    while (video.firstChild) video.removeChild(video.firstChild);
  } catch {
    // Ignore.
  }
  video.removeAttribute("src");
  video.src = "";
  video.removeAttribute("poster");
  video.load();
}

function VideoThumb({
  path,
  size,
  objectFit = "object-cover",
  autoplay = false,
}: {
  path: string;
  size: "sm" | "md" | "lg";
  objectFit?: string;
  autoplay?: boolean;
}) {
  // Sticky for inspector autoplay so layout thrash cannot blank the preview.
  const { ref, inView } = useInView<HTMLDivElement>("80px", { sticky: autoplay || size !== "lg" });
  const [url, setUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [releasing, setReleasing] = useState(() => isMediaReleasing(path));
  const [reloadToken, setReloadToken] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Inspector (autoplay): always live. Gallery lg: play only while hovered.
  const wantsLive =
    size === "lg" && !releasing && (autoplay || (inView && hovered));

  const bindVideoRef = (el: HTMLVideoElement | null): void => {
    if (videoRef.current && videoRef.current !== el) {
      unloadVideoEl(videoRef.current);
    }
    videoRef.current = el;
  };

  useEffect(() => {
    return subscribeMediaRelease(() => {
      const next = isMediaReleasing(path);
      if (next) {
        unloadVideoEl(videoRef.current);
        setUrl(null);
        setHasFrame(false);
        setHovered(false);
      } else if (releasing) {
        // This path finished a delete pass — remount poster/video if needed.
        setReloadToken((value) => value + 1);
        setFailed(false);
      }
      setReleasing(next);
    });
  }, [path, releasing]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setPoster(null);
    void withVideoSlot(async () => {
      try {
        const thumb = await getThumbUrl(path).catch(() => null);
        if (!cancelled) setPoster(thumb);
      } catch {
        // Poster optional.
      }
    }, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [path, reloadToken]);

  useEffect(() => {
    if (!wantsLive) {
      setUrl(null);
      setHasFrame(false);
      unloadVideoEl(videoRef.current);
      return;
    }
    let cancelled = false;
    setHasFrame(false);
    void withVideoSlot(async () => {
      try {
        // Always stream via entropy:// — blob prefetch was blanking large gallery clips.
        const fileUrl = await getFileUrl(path);
        if (!cancelled && !isMediaReleasing(path)) setUrl(fileUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, () => cancelled);
    return () => {
      cancelled = true;
      unloadVideoEl(videoRef.current);
    };
  }, [path, wantsLive, reloadToken]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url || !wantsLive) return;

    let timer = 0;
    let cancelled = false;

    function clearTimer(): void {
      window.clearTimeout(timer);
      timer = 0;
    }

    async function playClip(): Promise<void> {
      const el = videoRef.current;
      if (!el || cancelled || isMediaReleasing(path)) return;
      try {
        el.currentTime = 0;
        await el.play();
        if (cancelled || autoplay || isMediaReleasing(path)) return;
        clearTimer();
        timer = window.setTimeout(() => {
          if (!cancelled) void playClip();
        }, VIDEO_CLIP_SECONDS * 1000);
      } catch {
        // Keep poster frame when autoplay is blocked.
      }
    }

    function onLoaded(): void {
      setHasFrame(true);
      void playClip();
    }

    video.addEventListener("loadeddata", onLoaded);
    if (video.readyState >= 2) onLoaded();

    return () => {
      cancelled = true;
      clearTimer();
      video.removeEventListener("loadeddata", onLoaded);
      unloadVideoEl(video);
    };
  }, [url, wantsLive, autoplay, path]);

  const shellProps = {
    ref,
    className: "relative h-full w-full overflow-hidden bg-ink-2",
    onPointerEnter: () => {
      if (!isMediaReleasing(path)) setHovered(true);
    },
    onPointerLeave: () => {
      if (!autoplay) setHovered(false);
    },
  } as const;

  if (failed && !poster) {
    return (
      <div {...shellProps} className="flex h-full w-full items-center justify-center bg-ink-2">
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

  // Keep the poster under the video until a frame is ready — never flash an empty box.
  return (
    <div {...shellProps}>
      {poster ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn(
            "absolute inset-0 h-full w-full",
            objectFit,
            hasFrame && wantsLive ? "opacity-0" : "opacity-100",
          )}
        />
      ) : !hasFrame ? (
        <div className="absolute inset-0 bg-ink-2" />
      ) : null}
      {url && wantsLive ? (
        <video
          key={`${url}:${reloadToken}`}
          ref={bindVideoRef}
          src={url}
          poster={poster ?? undefined}
          muted
          playsInline
          loop={autoplay}
          preload="metadata"
          draggable={false}
          className={cn(
            "relative h-full w-full",
            objectFit,
            hasFrame ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
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
