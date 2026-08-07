import { useEffect, useRef, useState } from "react";

function parseRootMarginPx(rootMargin: string): number {
  const match = /^(-?\d+(?:\.\d+)?)px\b/i.exec(rootMargin.trim());
  if (!match) return 120;
  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.abs(value) : 120;
}

/**
 * Observe element visibility for lazy media.
 * sticky (default): once visible, stays armed so gallery sort does not blank images.
 * sticky=false: tracks enter/leave so off-screen media can pause.
 *
 * Note: the app shell may use CSS `zoom`, which breaks IntersectionObserver in Chromium.
 * We always cross-check with getBoundingClientRect against the viewport (not "any laid-out box").
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

    const margin = parseRootMarginPx(rootMargin);

    function isInViewport(el: Element): boolean {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      return (
        rect.bottom >= -margin &&
        rect.top <= vh + margin &&
        rect.right >= -margin &&
        rect.left <= vw + margin
      );
    }

    function armIfVisible(): void {
      const el = ref.current;
      if (!el) return;
      if (isInViewport(el)) setInView(true);
      else if (!sticky) setInView(false);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        // Prefer IO when it works; still verify with rect under CSS zoom.
        if (entry.isIntersecting && isInViewport(entry.target)) setInView(true);
        else if (!sticky) setInView(false);
      },
      { root: null, rootMargin, threshold: 0 },
    );

    observer.observe(node);
    armIfVisible();
    requestAnimationFrame(armIfVisible);
    const fallback = window.setTimeout(armIfVisible, 120);
    window.addEventListener("scroll", armIfVisible, { passive: true, capture: true });
    window.addEventListener("resize", armIfVisible, { passive: true });

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
      window.removeEventListener("scroll", armIfVisible, true);
      window.removeEventListener("resize", armIfVisible);
    };
  }, [rootMargin, inView, sticky]);

  return { ref, inView };
}
