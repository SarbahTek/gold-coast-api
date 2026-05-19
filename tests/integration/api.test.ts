import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { FastifyInstance } from 'fastify'

// Integration tests run against a real test DB
// Set DATABASE_URL and REDIS_URL in .env.test

let app: FastifyInstance

beforeAll(async () => {
  process.env['NODE_ENV'] = 'test'
  const { buildApp } = await import('../../src/app')
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('Health endpoints', () => {
  it('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('ok')
  })
})

describe('Products API', () => {
  it('GET /api/v1/products returns paginated list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.meta).toHaveProperty('total')
    expect(body.meta).toHaveProperty('page')
  })

  it('GET /api/v1/products with category filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products?category=wig',
    })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/v1/products/:id returns 404 for non-existent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products/999999' })
    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('POST /api/v1/products returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      payload: { name: 'Test Wig', price: 100, category: 'wig' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('Auth API', () => {
  const testUser = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: `test-${Date.now()}@goldcoasthair.test`,
    password: 'Password123',
  }

  it('POST /api/v1/auth/register creates account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: testUser,
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.data.accessToken).toBeDefined()
    expect(body.data.refreshToken).toBeDefined()
    expect(body.data.user.email).toBe(testUser.email)
  })

  it('POST /api/v1/auth/register rejects duplicate email', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: testUser })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: testUser,
    })
    expect(res.statusCode).toBe(409)
  })

  it('POST /api/v1/auth/login with valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testUser.email, password: testUser.password },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.accessToken).toBeDefined()
  })

  it('POST /api/v1/auth/login rejects wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testUser.email, password: 'wrongPassword123' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('Order tracking', () => {
  it('GET /api/v1/orders/track returns 404 for unknown order', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/orders/track?orderNumber=GCH-2025-000000&phone=+233000000000',
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('Reviews', () => {
  it('GET /api/v1/reviews/summary returns aggregate stats', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/reviews/summary' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data).toHaveProperty('average')
    expect(body.data).toHaveProperty('total')
    expect(body.data).toHaveProperty('ratingBreakdown')
  })
})
