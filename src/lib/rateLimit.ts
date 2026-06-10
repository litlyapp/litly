// In-memory sliding-window rate limiter. Per-instance only — resets on cold
// start and isn't shared across regions, but stops casual scripted abuse.
const hits = new Map<string, number[]>();

/**
 * Returns true if the action is allowed, false if the key has exceeded
 * `limit` calls within the trailing `windowMs` milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    hits.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return true;
}
