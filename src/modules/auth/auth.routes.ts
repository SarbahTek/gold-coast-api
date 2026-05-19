import { FastifyInstance } from 'fastify'
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  adminLoginController,
} from './auth.controller'
import { swaggerSchemas } from '../../config/swagger'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', { schema: swaggerSchemas.register }, registerController)
  app.post('/auth/login', { schema: swaggerSchemas.login }, loginController)
  app.post('/auth/refresh', { schema: swaggerSchemas.refresh }, refreshController)
  app.post('/auth/logout', { schema: swaggerSchemas.logout }, logoutController)
  app.post('/auth/admin/login', { schema: swaggerSchemas.adminLogin }, adminLoginController)
}
