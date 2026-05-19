import { FastifyRequest } from 'fastify'
import { getRedis } from '../../config/redis'

const MAX_LOGIN_ATTEMPTS = 10
const WINDOW_SECONDS = 15 * 60 // 15 minutes

/**
 * Checks and increments a Redis counter for a given key.
 * Throws LoginRateLimitError if the limit is exceeded within the window.
 *
 * Used on auth endpoints (login, register) to slow down credential stuffing
 * and brute-force attacks. IP-based — rate is per-client, not per-user,
 * to prevent account enumeration via error response timing.
 */
export async function checkLoginRateLimit(request: FastifyRequest): Promise<void> {
  const redis = getRedis()
  const ip = (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
    ?? request.ip

  const key = `auth:ratelimit:${ip}`

  const count = await redis.incr(key)

  if (count === 1) {
    // Set expiry only on first increment — avoids resetting the window on each attempt
    await redis.expire(key, WINDOW_SECONDS)
  }

  if (count > MAX_LOGIN_ATTEMPTS) {
    const ttl = await redis.ttl(key)
    throw new LoginRateLimitError(ttl)
  }
}

export async function clearLoginRateLimit(request: FastifyRequest): Promise<void> {
  const redis = getRedis()
  const ip = (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
    ?? request.ip
  await redis.del(`auth:ratelimit:${ip}`)
}

class LoginRateLimitError extends Error {
  readonly statusCode = 429
  readonly code = 'RATE_LIMITED'

  constructor(public readonly retryAfterSeconds: number) {
    super(
      `Too many login attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
    )
    this.name = 'LoginRateLimitError'
  }
}

// Re-export so error handler can recognise it
export { LoginRateLimitError }
