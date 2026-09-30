// Query params that only track the person who copied a link — analytics
// linker IDs, campaign tags, click IDs, and Mailchimp subscriber IDs (mc_eid
// identifies a specific newsletter recipient). Public event pages shouldn't
// carry them. Params a site needs (e.g. Eventbrite's aff=) are left alone.
const TRACKING_PARAM = /^(utm_\w+|_gl|_ga|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid)$/i;

/** Remove tracking query params from a URL; returns non-URLs unchanged. */
export function stripTracking(url: string): string;
export function stripTracking(url: string | null | undefined): string | null | undefined;
export function stripTracking(url: string | null | undefined) {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const keys = [...parsed.searchParams.keys()];
  if (!keys.some((k) => TRACKING_PARAM.test(k))) return url;
  for (const key of keys) if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
  return parsed.toString();
}
