"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPixel } from "@/lib/pixel";

// Fires PageView on client-side route changes. The pixel snippet in
// layout.tsx already fires one on the initial full page load, so the
// first render is skipped to avoid double-counting.
export default function MetaPixelPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    trackPixel("PageView");
  }, [pathname, searchParams]);

  return null;
}
