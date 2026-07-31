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

function PdfThumb({ path, size }: { path: string; size: "sm" | "md" | "lg" }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void getFileUrl(path)
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed || !url) {
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

  // First page only; chrome PDF toolbar hidden when supported.
  const src = `${url}#page=1&view=FitH&toolbar=0&navpanes=0`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-2">
      <iframe
        title="PDF preview"
        src={src}
        className="pointer-events-none absolute inset-0 h-[140%] w-full origin-top border-0 bg-ink-2"
        tabIndex={-1}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-paper-2">PDF</span>
      </div>
    </div>
  );
}

function VideoThumb({ path, size }: { path: string; size: "sm" | "md" | "lg" }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void withVideoSlot(async () => {
      try {
        const next = await getFileUrl(path);
        if (!cancelled) setUrl(next);
      } catch {
        if (!cancelled) setFailed(true);
      }
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
        // Seek slightly so Chromium paints a real frame (not black).
        el.currentTime = 0.1;
      } catch {
        // Ignore seek failures.
      }
    }

    function onError(): void {
      setFailed(true);
    }

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onError);
    if (video.readyState >= 2) onLoaded();

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
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
    <video
      ref={videoRef}
      src={url}
      muted
      playsInline
      preload="metadata"
      draggable={false}
      className="h-full w-full object-cover"
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
