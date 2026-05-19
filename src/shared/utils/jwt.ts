import jwt, { JwtPayload } from 'jsonwebtoken'

import { env } from '../../config/env'
import { UnauthorizedError } from '../../shared/errors/AppError'

export type TokenType = 'customer' | 'admin'

export interface AccessTokenPayload {
  sub: number
  email: string
  type: TokenType
  role?: string
}

export interface RefreshTokenPayload {
  sub: number
  type: TokenType
  jti: string
}

export function signAccessToken(
  payload: AccessTokenPayload
): string {
  return jwt.sign(
    payload,
    env.JWT_ACCESS_SECRET,
    {
      expiresIn:
        env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    }
  )
}

export function signRefreshToken(
  payload: RefreshTokenPayload
): string {
  return jwt.sign(
    payload,
    env.JWT_REFRESH_SECRET,
    {
      expiresIn:
        env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    }
  )
}

export function verifyAccessToken(
  token: string
): AccessTokenPayload {
  try {
    const decoded = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET
    ) as JwtPayload

    return decoded as unknown as AccessTokenPayload
  } catch {
    throw new UnauthorizedError(
      'Invalid or expired access token'
    )
  }
}

export function verifyRefreshToken(
  token: string
): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(
      token,
      env.JWT_REFRESH_SECRET
    ) as JwtPayload

    return decoded as unknown as RefreshTokenPayload
  } catch {
    throw new UnauthorizedError(
      'Invalid or expired refresh token'
    )
  }
}

export function getRefreshTokenExpiry(): Date {
  const ms = parseDuration(
    env.JWT_REFRESH_EXPIRES_IN
  )

  return new Date(Date.now() + ms)
}

function parseDuration(duration: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }

  const match = duration.match(
    /^(\d+)([smhd])$/
  )

  if (!match?.[1] || !match?.[2]) {
    throw new Error(
      `Invalid duration: ${duration}`
    )
  }

  return (
    parseInt(match[1], 10) *
    (units[match[2]] ?? 1000)
  )
}