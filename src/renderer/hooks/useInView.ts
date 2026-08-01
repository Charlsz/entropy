import { useEffect, useRef, useState } from "react";

/**
 * Observe element visibility for lazy media.
 * Once visible, stays armed so gallery reorders (sort) do not blank previews.
 */
export function useInView<T extends Element>(rootMargin = "120px"): {
  ref: React.RefObject<T | null>;
  inView: boolean;
} {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;

    function armIfVisible(): void {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 120;
      const visible =
        rect.bottom >= -margin &&
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) + margin &&
        rect.right >= -margin &&
        rect.left <= (window.innerWidth || document.documentElement.clientWidth) + margin;
      if (visible) setInView(true);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { root: null, rootMargin, threshold: 0 },
    );

    observer.observe(node);
    armIfVisible();
    requestAnimationFrame(armIfVisible);

    return () => observer.disconnect();
  }, [rootMargin, inView]);

  return { ref, inView };
}
