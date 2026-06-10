import { FastifyInstance, FastifyError } from 'fastify'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { AppError } from '../errors/AppError'
import { LoginRateLimitError } from '../utils/rateLimiter'
import { failure } from '../types/response'

export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    const logger = request.log

    // Helper: send error response bypassing Fastify's schema serializer.
    // Fastify serializes error responses through the route's declared response
    // schema. If the error shape doesn't exactly match that schema, fast-json-stringify
    // throws and produces a second serialization error (the "code is required" crash loop).
    // Calling reply.serializer(JSON.stringify) before .send() forces raw JSON output
    // regardless of what schema the route declared.
    const sendError = (statusCode: number, body: unknown) => {
      return reply
        .status(statusCode)
        .serializer(JSON.stringify)
        .send(body)
    }

    // Login brute-force rate limit
    if (error instanceof LoginRateLimitError) {
      reply.header('Retry-After', String(error.retryAfterSeconds))
      return sendError(429, failure('RATE_LIMITED', error.message))
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      return sendError(400, failure('VALIDATION_ERROR', 'Validation failed', error.flatten()))
    }

    // Our custom app errors
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error({ err: error }, 'Application error')
      } else {
        logger.info(error.message)
      }
      return sendError(error.statusCode, failure(error.code, error.message, error.details))
    }

    // Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return sendError(409, failure('CONFLICT', 'A record with this value already exists', {
          fields: error.meta?.target,
        }))
      }
      if (error.code === 'P2025') {
        return sendError(404, failure('NOT_FOUND', 'Record not found'))
      }
      logger.error({ err: error }, 'Prisma error')
      return sendError(500, failure('DATABASE_ERROR', 'Database error'))
    }

    // Fastify validation errors (schema validation)
    if ('validation' in error && error.validation) {
      return sendError(400, failure('VALIDATION_ERROR', error.message, error.validation))
    }

    // Generic errors
    logger.error({ err: error }, 'Unhandled error')
    return sendError(500, failure(
      'INTERNAL_ERROR',
      process.env['NODE_ENV'] === 'production'
        ? 'An unexpected error occurred'
        : error.message,
    ))
  })

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(
      failure('NOT_FOUND', `Route ${request.method} ${request.url} not found`),
    )
  })
}
