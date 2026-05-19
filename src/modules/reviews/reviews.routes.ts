import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import {
  listReviews,
  getReviewSummary,
  createReview,
  deleteReview,
  createReviewSchema,
  listReviewsSchema,
} from './reviews.service'
import { success } from '../../shared/types/response'
import { authenticateOptional, requireAdmin } from '../../shared/middleware/auth.middleware'
import { parseId } from '../../shared/utils/pagination'
import { swaggerSchemas } from '../../config/swagger'

async function listReviewsController(req: FastifyRequest, reply: FastifyReply) {
  const query = listReviewsSchema.parse(req.query)
  const result = await listReviews(query)
  reply.send(success(result.data, undefined, result.meta))
}

async function summaryController(req: FastifyRequest, reply: FastifyReply) {
  const { productId } = req.query as { productId?: string }
  const id = productId ? parseId(productId) : undefined
  const summary = await getReviewSummary(id)
  reply.send(success(summary))
}

async function createReviewController(req: FastifyRequest, reply: FastifyReply) {
  const dto = createReviewSchema.parse(req.body)
  const review = await createReview(dto, req.user?.sub)
  reply.status(201).send(success(review, 'Review submitted'))
}

async function deleteReviewController(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const id = parseId(req.params.id)
  const isAdmin = req.user?.type === 'admin'
  await deleteReview(id, req.user?.sub, isAdmin)
  reply.send(success(null, 'Review deleted'))
}

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reviews', { schema: swaggerSchemas.listReviews }, listReviewsController)
  app.get('/reviews/summary', { schema: swaggerSchemas.reviewSummary }, summaryController)
  app.post('/reviews', { schema: swaggerSchemas.createReview, preHandler: authenticateOptional }, createReviewController)
  app.delete<{ Params: { id: string } }>('/reviews/:id', { schema: swaggerSchemas.deleteReview, preHandler: authenticateOptional }, deleteReviewController)
}
