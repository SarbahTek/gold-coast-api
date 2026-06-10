import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { NotFoundError, ForbiddenError, ConflictError } from '../../shared/errors/AppError'
import { getPaginationParams, paginate, PaginationMeta } from '../../shared/types/response'

export const createReviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(255).optional(),
  body: z.string().optional(),
  location: z.string().optional(),
  // For guest reviews (unauthed)
  guestName: z.string().optional(),
})

export const listReviewsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.coerce.number().int().positive().optional(),
  verified: z.string().optional().transform((v) => v === 'true'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
})

export type CreateReviewDto = z.infer<typeof createReviewSchema>
export type ListReviewsDto = z.infer<typeof listReviewsSchema>

const REVIEW_SELECT = {
  id: true,
  rating: true,
  title: true,
  body: true,
  isVerified: true,
  location: true,
  createdAt: true,
  product: { select: { id: true, name: true } },
  customer: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ReviewSelect

type ReviewWithDetails = Prisma.ReviewGetPayload<{ select: typeof REVIEW_SELECT }>

export async function listReviews(
  query: ListReviewsDto,
): Promise<{ data: ReviewWithDetails[]; meta: PaginationMeta }> {
  const { page, limit, skip, take } = getPaginationParams(query.page, query.limit)

  const where: Prisma.ReviewWhereInput = {
    deletedAt: null,
    ...(query.productId && { productId: query.productId }),
    ...(query.verified && { isVerified: true }),
    ...(query.rating && { rating: query.rating }),
  }

  const [data, total] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      select: REVIEW_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.review.count({ where }),
  ])

  return { data, meta: paginate(total, page, limit) }
}

export async function getReviewSummary(productId?: number) {
  const where: Prisma.ReviewWhereInput = {
    deletedAt: null,
    ...(productId && { productId }),
  }

  const [aggregate, breakdown] = await prisma.$transaction([
    prisma.review.aggregate({
      where,
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.review.groupBy({
      by: ['rating'],
      where,
      _count: { rating: true },
      orderBy: { rating: 'desc' },
    }),
  ])

  const total = aggregate._count.rating
  const avg = aggregate._avg.rating ?? 0

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => {
    const found = breakdown.find((b) => b.rating === star)
    const count =
  typeof found?._count === 'object'
    ? found._count.rating ?? 0
    : 0
    return {
      star,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }
  })

  return { average: Math.round(avg * 10) / 10, total, ratingBreakdown }
}

export async function createReview(dto: CreateReviewDto, customerId?: number) {
  // Ensure product exists
  const product = await prisma.product.findFirst({
    where: { id: dto.productId, deletedAt: null },
    select: { id: true },
  })
  if (!product) throw new NotFoundError('Product', dto.productId)

  // Prevent duplicate reviews from same customer
  if (customerId) {
    const existing = await prisma.review.findFirst({
      where: { productId: dto.productId, customerId, deletedAt: null },
    })
    if (existing) throw new ConflictError('You have already reviewed this product')
  }

  // Auto-verify if customer has a delivered order containing this product
  let isVerified = false
  if (customerId) {
    const purchasedOrder = await prisma.orderItem.findFirst({
      where: {
        productId: dto.productId,
        order: { customerId, status: 'delivered' },
      },
    })
    isVerified = !!purchasedOrder
  }

  return prisma.review.create({
    data: {
      productId: dto.productId,
      customerId,
      rating: dto.rating,
      title: dto.title,
      body: dto.body,
      location: dto.location,
      isVerified,
    },
    select: REVIEW_SELECT,
  })
}

export async function deleteReview(id: number, requesterId?: number, isAdmin = false) {
  const review = await prisma.review.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, customerId: true },
  })
  if (!review) throw new NotFoundError('Review', id)
  if (!isAdmin && review.customerId !== requesterId) throw new ForbiddenError()

  await prisma.review.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}
