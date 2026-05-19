import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import {
  placeOrder,
  trackOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  createOrderSchema,
  trackOrderSchema,
  updateOrderStatusSchema,
  listOrdersSchema,
} from './orders.service'
import { success } from '../../shared/types/response'
import { requireAdmin, authenticate } from '../../shared/middleware/auth.middleware'
import { parseId } from '../../shared/utils/pagination'
import { swaggerSchemas } from '../../config/swagger'

async function placeOrderController(req: FastifyRequest, reply: FastifyReply) {
  const dto = createOrderSchema.parse(req.body)
  const order = await placeOrder(dto)
  reply.status(201).send(success(order, 'Order placed successfully'))
}

async function trackOrderController(req: FastifyRequest, reply: FastifyReply) {
  const dto = trackOrderSchema.parse(req.query)
  const order = await trackOrder(dto)
  reply.send(success(order))
}

async function listOrdersController(req: FastifyRequest, reply: FastifyReply) {
  const query = listOrdersSchema.parse(req.query)
  const result = await listOrders(query)
  reply.send(success(result.data, undefined, result.meta))
}

async function getOrderController(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const order = await getOrder(parseId(req.params.id))
  reply.send(success(order))
}

async function updateOrderStatusController(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const dto = updateOrderStatusSchema.parse(req.body)
  // req.user is guaranteed by requireAdmin() preHandler
  const adminId = req.user?.sub ?? 0
  const order = await updateOrderStatus(parseId(req.params.id), dto, adminId)
  reply.send(success(order, 'Order status updated'))
}

async function cancelOrderController(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const id = parseId(req.params.id)
  const isAdmin = req.user?.type === 'admin'
  const order = await cancelOrder(id, req.user?.sub, isAdmin)
  reply.send(success(order, 'Order cancelled'))
}

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  // Public
  app.post('/orders', { schema: swaggerSchemas.placeOrder }, placeOrderController)
  app.get('/orders/track', { schema: swaggerSchemas.trackOrder }, trackOrderController)

  // Customer
  app.delete<{ Params: { id: string } }>(
    '/orders/:id',
    { schema: swaggerSchemas.cancelOrder, preHandler: authenticate },
    cancelOrderController
  )

  // Admin
  app.get('/orders', { schema: swaggerSchemas.listOrders, preHandler: requireAdmin() }, listOrdersController)
  app.get<{ Params: { id: string } }>('/orders/:id', { schema: swaggerSchemas.getOrder, preHandler: requireAdmin() }, getOrderController)
  app.put<{ Params: { id: string } }>('/orders/:id/status', { schema: swaggerSchemas.updateOrderStatus, preHandler: requireAdmin() }, updateOrderStatusController)
}
