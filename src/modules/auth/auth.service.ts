import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../../shared/utils/jwt'
import {
  ConflictError,
  UnauthorizedError,
} from '../../shared/errors/AppError'
import type { RegisterDto, LoginDto, AdminLoginDto } from './auth.schema'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResult extends AuthTokens {
  user: {
    id: number
    email: string
    firstName: string
    lastName: string
  }
}

// ─── Customer Auth ────────────────────────────────────────────────────────────

export async function registerCustomer(dto: RegisterDto): Promise<AuthResult> {
  const existing = await prisma.customer.findFirst({
    where: { email: dto.email, deletedAt: null },
  })

  if (existing) throw new ConflictError('Email already registered')

  const passwordHash = await bcrypt.hash(dto.password, env.BCRYPT_ROUNDS)

  const customer = await prisma.customer.create({
    data: {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  })

  const tokens = await issueCustomerTokens(customer.id, customer.email)

  return { ...tokens, user: customer }
}

export async function loginCustomer(dto: LoginDto): Promise<AuthResult> {
  const customer = await prisma.customer.findFirst({
    where: { email: dto.email, deletedAt: null },
  })

  if (!customer) throw new UnauthorizedError('Invalid email or password')

  const valid = await bcrypt.compare(dto.password, customer.passwordHash)
  if (!valid) throw new UnauthorizedError('Invalid email or password')

  const tokens = await issueCustomerTokens(customer.id, customer.email)

  return {
    ...tokens,
    user: {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    },
  }
}

export async function refreshCustomerToken(
  refreshToken: string,
): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken)

  if (payload.type !== 'customer') {
    throw new UnauthorizedError('Invalid token type')
  }

  const stored = await prisma.refreshToken.findFirst({
    where: { token: refreshToken, revokedAt: null },
    include: { customer: { select: { id: true, email: true, deletedAt: true } } },
  })

  if (!stored || stored.customer.deletedAt) {
    throw new UnauthorizedError('Refresh token invalid or revoked')
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token expired')
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  })

  return issueCustomerTokens(stored.customer.id, stored.customer.email)
}

export async function logoutCustomer(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
    data: { revokedAt: new Date() },
  })
}

// ─── Admin Auth ───────────────────────────────────────────────────────────────

export async function loginAdmin(dto: AdminLoginDto): Promise<AuthTokens & { admin: { id: number; email: string; name: string; role: string } }> {
  const admin = await prisma.adminUser.findFirst({
    where: { email: dto.email, deletedAt: null },
  })

  if (!admin) throw new UnauthorizedError('Invalid credentials')

  const valid = await bcrypt.compare(dto.password, admin.passwordHash)
  if (!valid) throw new UnauthorizedError('Invalid credentials')

  const jti = nanoid()
  const accessToken = signAccessToken({
    sub: admin.id,
    email: admin.email,
    type: 'admin',
    role: admin.role,
  })

  const refreshToken = signRefreshToken({ sub: admin.id, type: 'admin', jti })

  await prisma.adminRefreshToken.create({
    data: {
      token: refreshToken,
      adminUserId: admin.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  })

  return {
    accessToken,
    refreshToken,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function issueCustomerTokens(
  customerId: number,
  email: string,
): Promise<AuthTokens> {
  const jti = nanoid()

  const accessToken = signAccessToken({ sub: customerId, email, type: 'customer' })
  const refreshToken = signRefreshToken({ sub: customerId, type: 'customer', jti })

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      customerId,
      expiresAt: getRefreshTokenExpiry(),
    },
  })

  return { accessToken, refreshToken }
}
