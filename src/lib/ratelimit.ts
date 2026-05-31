// ============================================================
// Rate limiting — Redis-backed fixed-window counter. Used on
// public booking/waitlist endpoints and auth actions (CLAUDE.md
// §7). Degrades OPEN if Redis is unavailable: a limiter outage
// must never take down booking. Keys are namespaced per action +
// identifier (IP or tenant) so limits are independent.
// ============================================================

import { redis } from "@/lib/redis"

export interface RateLimitResult {
  ok: boolean
  remaining: number
  limit: number
  retryAfterSec: number
}

/**
 * Fixed-window rate limit. `key` should already encode the action and
 * identifier, e.g. `booking:ip:1.2.3.4`. Returns ok=false when the
 * window count exceeds `limit`. Fails OPEN on any Redis error.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`
  try {
    const count = await redis.incr(redisKey)
    if (count === 1) {
      // First hit in this window — set expiry.
      await redis.expire(redisKey, windowSec)
    }
    const ttl = count === 1 ? windowSec : await redis.ttl(redisKey)
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      retryAfterSec: ttl > 0 ? ttl : windowSec,
    }
  } catch {
    // Fail open — never block real traffic because the limiter is down.
    return { ok: true, remaining: limit, limit, retryAfterSec: 0 }
  }
}

// Common presets (limit per window).
export const LIMITS = {
  // Public booking: 10 attempts / minute per IP.
  publicBooking: { limit: 10, windowSec: 60 },
  // Auth: 5 attempts / minute per IP (brute-force guard).
  auth: { limit: 5, windowSec: 60 },
  // Per-tenant booking volume guard: 60 / minute.
  tenantBooking: { limit: 60, windowSec: 60 },
} as const

/** Best-effort client IP from standard proxy headers. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return headers.get("x-real-ip") ?? "unknown"
}
