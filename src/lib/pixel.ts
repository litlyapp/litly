// Meta Pixel helpers. The pixel snippet in src/app/layout.tsx defines
// window.fbq; these wrappers no-op safely if it hasn't loaded (ad blockers).

type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof f === "function" ? f : null;
}

/** Standard Meta events, e.g. "PageView", "CompleteRegistration". */
export function trackPixel(event: string, params?: Record<string, unknown>) {
  fbq()?.("track", event, params);
}

/** Custom events, e.g. "RSVP", "SaveEvent". */
export function trackPixelCustom(event: string, params?: Record<string, unknown>) {
  fbq()?.("trackCustom", event, params);
}
