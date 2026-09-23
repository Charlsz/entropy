import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { dirname, join } from "../lib/paths";

interface NoteCoverProps {
  notePath: string;
  coverHref: string;
  className?: string;
}

export function NoteCover({ notePath, coverHref, className }: NoteCoverProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (/^(https?:|data:)/i.test(coverHref)) {
          if (!cancelled) setUrl(coverHref);
          return;
        }
        const noteDir = dirname(notePath);
        const absolute = join(noteDir, coverHref);
        if (!(await window.entropy.fs.exists(absolute))) {
          if (!cancelled) setUrl(null);
          return;
        }
        const next = await window.entropy.fs.toUrl(absolute);
        if (!cancelled) setUrl(next);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [notePath, coverHref]);

  if (!url) return null;

  return (
    <div className={cn("mx-auto w-full max-w-[720px] px-8", className)}>
      <img
        src={url}
        alt=""
        className="h-40 w-full rounded-lg object-cover object-center sm:h-52"
        draggable={false}
      />
    </div>
  );
}
