import { FastifyInstance } from 'fastify'
import { prisma } from '../../config/database'
import { getRedis } from '../../config/redis'
import { swaggerSchemas } from '../../config/swagger'

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  uptime: number
  version: string
  services: {
    database: 'ok' | 'error'
    redis: 'ok' | 'error'
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', { schema: swaggerSchemas.health }, async (_req, reply) => {
    reply.send({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.get('/health/detailed', { schema: swaggerSchemas.healthDetailed }, async (_req, reply) => {
    const checks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      getRedis().ping(),
    ])

    const dbOk = checks[0]?.status === 'fulfilled'
    const redisOk = checks[1]?.status === 'fulfilled'

    const status: HealthStatus = {
      status: dbOk && redisOk ? 'ok' : !dbOk ? 'down' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env['npm_package_version'] ?? '1.0.0',
      services: {
        database: dbOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    }

    const httpStatus = status.status === 'down' ? 503 : 200
    reply.status(httpStatus).send(status)
  })

  app.get('/health/ready', { schema: swaggerSchemas.healthReady }, async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      reply.send({ ready: true })
    } catch {
      reply.status(503).send({ ready: false, reason: 'database not ready' })
    }
  })
}
