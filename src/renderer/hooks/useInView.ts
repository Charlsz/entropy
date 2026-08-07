import { useEffect, useRef, useState } from "react";

/**
 * Observe element visibility for lazy media.
 * sticky (default): once visible, stays armed so gallery sort does not blank images.
 * sticky=false: tracks enter/leave (videos) so decoders pause off-screen.
 *
 * Note: the app shell uses CSS `zoom`, which breaks IntersectionObserver in Chromium.
 * We fall back to a laid-out size check so media still arms under zoom.
 */
export function useInView<T extends Element>(
  rootMargin = "120px",
  options?: { sticky?: boolean },
): {
  ref: React.RefObject<T | null>;
  inView: boolean;
} {
  const sticky = options?.sticky ?? true;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (sticky && inView) return;

    function armIfVisible(): void {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Under CSS zoom, IO is unreliable — treat a laid-out box as visible.
      if (rect.width > 2 && rect.height > 2) {
        setInView(true);
        return;
      }
      const margin = 120;
      const visible =
        rect.bottom >= -margin &&
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) + margin &&
        rect.right >= -margin &&
        rect.left <= (window.innerWidth || document.documentElement.clientWidth) + margin;
      if (visible) setInView(true);
      else if (!sticky) setInView(false);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) setInView(true);
        else if (!sticky) setInView(false);
      },
      { root: null, rootMargin, threshold: 0 },
    );

    observer.observe(node);
    armIfVisible();
    requestAnimationFrame(armIfVisible);
    const fallback = window.setTimeout(armIfVisible, 120);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [rootMargin, inView, sticky]);

  return { ref, inView };
}
