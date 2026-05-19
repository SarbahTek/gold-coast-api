import { FastifyRequest, FastifyReply } from 'fastify'
import {
  registerCustomer,
  loginCustomer,
  refreshCustomerToken,
  logoutCustomer,
  loginAdmin,
} from './auth.service'
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  adminLoginSchema,
} from './auth.schema'
import { success } from '../../shared/types/response'
import { checkLoginRateLimit, clearLoginRateLimit } from '../../shared/utils/rateLimiter'

export async function registerController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await checkLoginRateLimit(request)
  const dto = registerSchema.parse(request.body)
  const result = await registerCustomer(dto)
  await clearLoginRateLimit(request)
  reply.status(201).send(success(result, 'Account created successfully'))
}

export async function loginController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await checkLoginRateLimit(request)
  const dto = loginSchema.parse(request.body)
  const result = await loginCustomer(dto)
  // Clear on success — legitimate users shouldn't stay throttled
  await clearLoginRateLimit(request)
  reply.send(success(result, 'Login successful'))
}

export async function refreshController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { refreshToken } = refreshSchema.parse(request.body)
  const tokens = await refreshCustomerToken(refreshToken)
  reply.send(success(tokens))
}

export async function logoutController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { refreshToken } = refreshSchema.parse(request.body)
  await logoutCustomer(refreshToken)
  reply.send(success(null, 'Logged out successfully'))
}

export async function adminLoginController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await checkLoginRateLimit(request)
  const dto = adminLoginSchema.parse(request.body)
  const result = await loginAdmin(dto)
  await clearLoginRateLimit(request)
  reply.send(success(result, 'Admin login successful'))
}

