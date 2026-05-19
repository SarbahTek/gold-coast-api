import { FastifyInstance } from 'fastify'
import {
  listProductsController,
  getProductController,
  getFeaturedController,
  getSaleController,
  getCategoriesController,
  createProductController,
  updateProductController,
  deleteProductController,
} from './products.controller'
import { requireAdmin } from '../../shared/middleware/auth.middleware'
import { swaggerSchemas } from '../../config/swagger'

export async function productRoutes(app: FastifyInstance): Promise<void> {
  // Public
  app.get('/products', { schema: swaggerSchemas.listProducts }, listProductsController)
  app.get('/products/featured', { schema: swaggerSchemas.getFeatured }, getFeaturedController)
  app.get('/products/sale', { schema: swaggerSchemas.getSale }, getSaleController)
  app.get('/products/categories', { schema: swaggerSchemas.getCategories }, getCategoriesController)
  app.get('/products/:id', { schema: swaggerSchemas.getProduct }, getProductController)

  // Admin only
  app.post('/products', { schema: swaggerSchemas.createProduct, preHandler: requireAdmin() }, createProductController)
  app.put<{ Params: { id: string } }>('/products/:id', { schema: swaggerSchemas.updateProduct, preHandler: requireAdmin() }, updateProductController)
  app.delete<{ Params: { id: string } }>('/products/:id', { schema: swaggerSchemas.deleteProduct, preHandler: requireAdmin() }, deleteProductController)
}
