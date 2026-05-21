import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

import { env } from './config/env'
import { getRedis } from './config/redis'

import { swaggerPlugin, definitions } from './config/swagger'
import { errorHandlerPlugin } from './shared/middleware/error.handler'

import { healthRoutes } from './shared/hooks/health.routes'
import { webhookRoutes } from './shared/hooks/webhooks'

import { authRoutes } from './modules/auth/auth.routes'
import { productRoutes } from './modules/products/products.routes'
import { orderRoutes } from './modules/orders/orders.routes'
import { reviewRoutes } from './modules/reviews/reviews.routes'
import { uploadRoutes } from './modules/uploads/uploads.routes'

import {
  enquiryRoutes,
  faqRoutes,
  promotionRoutes,
  customerLookRoutes,
  cartRoutes,
  bundleRoutes,
} from './modules/shared.routes'

import {
  adminRoutes,
  customerRoutes,
} from './modules/admin.routes'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,

      ...(env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        },
      }),
    },

    trustProxy: true,
    requestTimeout: 30000,
    bodyLimit: 5 * 1024 * 1024,
  })

  // ─────────────────────────────────────────────
  // SCHEMA REGISTRATION (MUST BE BEFORE EVERYTHING)
  // ─────────────────────────────────────────────
  // app.register() is async and deferred by avvio. Any addSchema() call
  // inside a plugin runs AFTER all sibling plugins have already queued
  // their route compilation — so AJV never sees the schemas in time.
  // Calling addSchema() directly on the root instance here is synchronous
  // and guarantees schemas are available before any plugin runs.
  const registered = new Set<string>()
  for (const schema of Object.values(definitions)) {
    const id = schema.$id
    if (!id || registered.has(id)) continue
    registered.add(id)
    app.addSchema(schema)
  }

  // ─────────────────────────────────────────────
  // SECURITY FIRST (safe early)
  // ─────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false,
  })

  await app.register(cors, {
    origin:
      env.CORS_ORIGINS === '*'
        ? true
        : env.CORS_ORIGINS.split(','),

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: ['Content-Type', 'Authorization'],

    credentials: true,
  })

  // ─────────────────────────────────────────────
  // RATE LIMITING
  // ─────────────────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    redis: getRedis(),

    keyGenerator: (request) =>
      (request.headers['x-forwarded-for'] as string) || request.ip,

    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Try again in ${Math.ceil(
          context.ttl / 1000,
        )}s`,
      },
    }),
  })

  // ─────────────────────────────────────────────
  // ERROR HANDLER
  // ─────────────────────────────────────────────
  await app.register(errorHandlerPlugin)

  // ─────────────────────────────────────────────
  // SWAGGER
  // ─────────────────────────────────────────────
  await app.register(swaggerPlugin)

  // ─────────────────────────────────────────────
  // HEALTH + WEBHOOKS (no schema dependency issues)
  // ─────────────────────────────────────────────
  await app.register(healthRoutes)
  await app.register(webhookRoutes)

  // ─────────────────────────────────────────────
  // API ROUTES (LAST)
  // ─────────────────────────────────────────────
  await app.register(
    async (api) => {
      await api.register(authRoutes)
      await api.register(productRoutes)
      await api.register(bundleRoutes)
      await api.register(cartRoutes)
      await api.register(orderRoutes)
      await api.register(reviewRoutes)
      await api.register(enquiryRoutes)
      await api.register(promotionRoutes)
      await api.register(faqRoutes)
      await api.register(customerLookRoutes)
      await api.register(uploadRoutes)
      await api.register(adminRoutes)
      await api.register(customerRoutes)
    },
    {
      prefix: env.API_PREFIX,
    },
  )

  // ─────────────────────────────────────────────
  // ROOT ROUTE
  // ─────────────────────────────────────────────
  app.get('/', async () => {
    return {
      success: true,
      message: `${env.APP_NAME} running`,
      docs: '/docs',
    }
  })

  return app
}