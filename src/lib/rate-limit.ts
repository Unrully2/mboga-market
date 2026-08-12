/**
 * In-memory rate limiter (PER-INSTANCE only).
 * On multi-instance serverless, each instance has its own Map — limits are not global.
 * For production-grade distributed limiting, wire Redis/Upstash and swap this module.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count += 1
  const remaining = Math.max(0, limit - bucket.count)
  const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000)

  // Periodic cleanup
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k)
    }
  }

  return {
    allowed: bucket.count <= limit,
    remaining,
    retryAfterSec,
  }
}

export function clientIp(req: Request): string {
  const h = req.headers
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  )
}
