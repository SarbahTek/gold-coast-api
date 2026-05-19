import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt'
import { UnauthorizedError, ForbiddenError } from '../errors/AppError'
import { AdminRole } from '@prisma/client'

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload
  }
}

function extractToken(request: FastifyRequest): string {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header')
  }
  return auth.slice(7)
}

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractToken(request)
  request.user = verifyAccessToken(token)
}

export async function authenticateOptional(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    const auth = request.headers.authorization
    if (auth?.startsWith('Bearer ')) {
      request.user = verifyAccessToken(auth.slice(7))
    }
  } catch {
    // Optional auth — silently ignore
  }
}

export function requireAdmin(roles: AdminRole[] = []) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = extractToken(request)
    const payload = verifyAccessToken(token)

    if (payload.type !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }

    if (roles.length > 0 && !roles.includes(payload.role as AdminRole)) {
      throw new ForbiddenError('Insufficient role permissions')
    }

    request.user = payload
  }
}

// requireCustomer is intentionally omitted — all customer-authenticated routes
// use the generic `authenticate` guard and check req.user.type inline,
// which avoids a second token extraction pass.
