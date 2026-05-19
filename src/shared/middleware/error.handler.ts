import { FastifyInstance, FastifyError } from 'fastify'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { AppError } from '../errors/AppError'
import { LoginRateLimitError } from '../utils/rateLimiter'
import { failure } from '../types/response'

export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    const logger = request.log

    // Login brute-force rate limit
    if (error instanceof LoginRateLimitError) {
      reply.header('Retry-After', String(error.retryAfterSeconds))
      return reply.status(429).send(failure('RATE_LIMITED', error.message))
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send(
        failure('VALIDATION_ERROR', 'Validation failed', error.flatten()),
      )
    }

    // Our custom app errors
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error({ err: error }, 'Application error')
      } else {
        logger.warn({ err: error }, 'Client error')
      }
      return reply.status(error.statusCode).send(
        failure(error.code, error.message, error.details),
      )
    }

    // Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply.status(409).send(
          failure('CONFLICT', 'A record with this value already exists', {
            fields: error.meta?.target,
          }),
        )
      }
      if (error.code === 'P2025') {
        return reply.status(404).send(failure('NOT_FOUND', 'Record not found'))
      }
      logger.error({ err: error }, 'Prisma error')
      return reply.status(500).send(failure('DATABASE_ERROR', 'Database error'))
    }

    // Fastify validation errors (schema validation)
    if ('validation' in error && error.validation) {
      return reply.status(400).send(
        failure('VALIDATION_ERROR', error.message, error.validation),
      )
    }

    // Generic errors
    logger.error({ err: error }, 'Unhandled error')
    return reply.status(500).send(
      failure(
        'INTERNAL_ERROR',
        process.env['NODE_ENV'] === 'production'
          ? 'An unexpected error occurred'
          : error.message,
      ),
    )
  })

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(
      failure('NOT_FOUND', `Route ${request.method} ${request.url} not found`),
    )
  })
}
