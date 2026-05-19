import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
vi.mock('../src/config/database', () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    adminUser: {
      findFirst: vi.fn(),
    },
    adminRefreshToken: {
      create: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    bundle: {
      findFirst: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
    auditLog: { create: vi.fn() },
  },
}))

vi.mock('../src/config/env', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-minimum-32-chars-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars-long',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_ROUNDS: 1, // Fast for tests
    NODE_ENV: 'test',
  },
}))

// ─── Auth Service Tests ───────────────────────────────────────────────────────
describe('Auth Service', () => {
  describe('registerCustomer', () => {
    it('should throw ConflictError if email already exists', async () => {
      const { prisma } = await import('../src/config/database')
      const { registerCustomer } = await import('../src/modules/auth/auth.service')

      vi.mocked(prisma.customer.findFirst).mockResolvedValueOnce({
        id: 1,
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        phone: null,
        passwordHash: 'hash',
        deletedAt: null,
        createdAt: new Date(),
      })

      await expect(
        registerCustomer({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'test@test.com',
          password: 'Password1',
        }),
      ).rejects.toThrow('Email already registered')
    })

    it('should create customer and return tokens', async () => {
      const { prisma } = await import('../src/config/database')
      const { registerCustomer } = await import('../src/modules/auth/auth.service')

      vi.mocked(prisma.customer.findFirst).mockResolvedValueOnce(null)
      vi.mocked(prisma.customer.create).mockResolvedValueOnce({
        id: 1,
        email: 'jane@test.com',
        firstName: 'Jane',
        lastName: 'Doe',
      } as any)
      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({} as any)

      const result = await registerCustomer({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        password: 'Password1',
      })

      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
      expect(result.user.email).toBe('jane@test.com')
    })
  })

  describe('loginCustomer', () => {
    it('should throw UnauthorizedError for wrong password', async () => {
      const { prisma } = await import('../src/config/database')
      const { loginCustomer } = await import('../src/modules/auth/auth.service')

      const hash = await bcrypt.hash('correctPassword1', 1)
      vi.mocked(prisma.customer.findFirst).mockResolvedValueOnce({
        id: 1,
        email: 'jane@test.com',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: null,
        passwordHash: hash,
        deletedAt: null,
        createdAt: new Date(),
      })

      await expect(
        loginCustomer({ email: 'jane@test.com', password: 'wrongPassword1' }),
      ).rejects.toThrow('Invalid email or password')
    })
  })
})

// ─── Order Number Generator ───────────────────────────────────────────────────
describe('Order number generator', () => {
  it('should generate GCH-YYYY-XXXXXX format', async () => {
    const { generateOrderNumber } = await import('../src/shared/utils/generators')
    const orderNum = generateOrderNumber()
    expect(orderNum).toMatch(/^GCH-\d{4}-\d{6}$/)
  })

  it('should generate unique order numbers', async () => {
    const { generateOrderNumber } = await import('../src/shared/utils/generators')
    const nums = new Set(Array.from({ length: 100 }, () => generateOrderNumber()))
    expect(nums.size).toBe(100)
  })
})

// ─── JWT Utilities ────────────────────────────────────────────────────────────
describe('JWT utilities', () => {
  it('should sign and verify access token', async () => {
    const { signAccessToken, verifyAccessToken } = await import('../src/shared/utils/jwt')
    const payload = { sub: 1, email: 'test@test.com', type: 'customer' as const }
    const token = signAccessToken(payload)
    const verified = verifyAccessToken(token)
    expect(verified.sub).toBe(1)
    expect(verified.email).toBe('test@test.com')
  })

  it('should throw on invalid token', async () => {
    const { verifyAccessToken } = await import('../src/shared/utils/jwt')
    expect(() => verifyAccessToken('invalid.token.here')).toThrow('Invalid or expired access token')
  })
})

// ─── Response helpers ─────────────────────────────────────────────────────────
describe('Response utilities', () => {
  it('should paginate correctly', async () => {
    const { paginate } = await import('../src/shared/types/response')
    const meta = paginate(100, 2, 10)
    expect(meta.total).toBe(100)
    expect(meta.page).toBe(2)
    expect(meta.totalPages).toBe(10)
    expect(meta.hasNext).toBe(true)
    expect(meta.hasPrev).toBe(true)
  })

  it('should detect last page', async () => {
    const { paginate } = await import('../src/shared/types/response')
    const meta = paginate(10, 1, 20)
    expect(meta.hasNext).toBe(false)
    expect(meta.hasPrev).toBe(false)
    expect(meta.totalPages).toBe(1)
  })
})
