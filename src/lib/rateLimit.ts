const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 5_000;

function evictExpired(now: number) {
  if (buckets.size < MAX_KEYS) {
    // Cheap opportunistic cleanup of a few keys
    let scanned = 0;
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
      if (++scanned > 50) break;
    }
    return;
  }
  for (const [k, v] of buckets) {
    if (now >= v.resetAt) buckets.delete(k);
  }
  if (buckets.size >= MAX_KEYS) {
    // Drop oldest-ish entries if still too large
    const keys = buckets.keys();
    for (let i = 0; i < 500; i++) {
      const next = keys.next();
      if (next.done) break;
      buckets.delete(next.value);
    }
  }
}

/** Simple in-memory rate limiter for auth endpoints. Resets per windowMs. */
export function rateLimit(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  evictExpired(now);
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (bucket) buckets.delete(key);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
