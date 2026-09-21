"use client";

import { useEffect, type RefObject } from "react";

/**
 * Forces every direct child of `ref` to the height of the tallest child,
 * so grid rows line up evenly instead of hugging each row's own content.
 * Only applied at `sm:` and up — mobile's single-column stack keeps its
 * natural per-card height.
 */
export function useEqualizeCardHeights(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = []
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const equalize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cards = Array.from(el.children) as HTMLElement[];
        if (cards.length === 0) return;

        cards.forEach((c) => {
          c.style.minHeight = "";
        });

        const isDesktop = window.matchMedia("(min-width: 640px)").matches;
        if (!isDesktop) return;

        const max = Math.max(...cards.map((c) => c.getBoundingClientRect().height));
        if (Number.isFinite(max) && max > 0) {
          cards.forEach((c) => {
            c.style.minHeight = `${max}px`;
          });
        }
      });
    };

    equalize();

    const ro = new ResizeObserver(equalize);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    window.addEventListener("resize", equalize);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", equalize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
