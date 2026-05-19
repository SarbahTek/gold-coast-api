import Redis from 'ioredis'
import { env } from './env'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (redis) return redis

  const redisUrl = env.REDIS_URL
  const isTLS = redisUrl.startsWith('rediss://')

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      if (times > 10) {
        console.error('Redis: max retries reached')
        return null
      }
      return Math.min(times * 100, 3000)
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
      if (targetErrors.some((e) => err.message.includes(e))) {
        return 1
      }
      return false
    },
    ...(isTLS && {
      tls: {
        rejectUnauthorized: false, // Railway Redis TLS self-signed certs
      },
    }),
  })

  redis.on('connect', () => console.info('Redis: connected'))
  redis.on('ready', () => console.info('Redis: ready'))
  redis.on('error', (err) => console.error('Redis error:', err.message))
  redis.on('close', () => console.warn('Redis: connection closed'))
  redis.on('reconnecting', () => console.info('Redis: reconnecting...'))

  return redis
}

export async function connectRedis(): Promise<void> {
  const client = getRedis()
  await client.ping()
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}
