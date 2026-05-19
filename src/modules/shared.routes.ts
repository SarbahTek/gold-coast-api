import { z } from 'zod'
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { EnquiryStatus, FaqCategory } from '@prisma/client'
import { prisma } from '../config/database'
import { getRedis } from '../config/redis'
import { NotFoundError } from '../shared/errors/AppError'
import { success, getPaginationParams, paginate } from '../shared/types/response'
import { requireAdmin, authenticateOptional } from '../shared/middleware/auth.middleware'
import { parsePaginationQuery, parseId } from '../shared/utils/pagination'
import { swaggerSchemas } from '../config/swagger'

// ═══════════════════════════════════════════════════════════════
// ENQUIRIES
// ═══════════════════════════════════════════════════════════════

const createEnquirySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  productInterest: z.string().optional(),
  message: z.string().min(10).max(2000),
})

const updateEnquiryStatusSchema = z.object({
  status: z.nativeEnum(EnquiryStatus),
})

export async function enquiryRoutes(app: FastifyInstance): Promise<void> {
  app.post('/enquiries', { schema: swaggerSchemas.createEnquiry }, async (req, reply) => {
    const dto = createEnquirySchema.parse(req.body)
    const enquiry = await prisma.enquiry.create({ data: dto })
    reply.status(201).send(success(enquiry, 'Enquiry submitted'))
  })

  app.get('/enquiries', { schema: swaggerSchemas.listEnquiries, preHandler: requireAdmin() }, async (req, reply) => {
    const { page, limit } = parsePaginationQuery(req.query as Record<string, string>)
    const { skip, take } = getPaginationParams(page, limit)
    const { status } = req.query as { status?: string }
    const where = status ? { status: status as EnquiryStatus } : {}
    const [data, total] = await prisma.$transaction([
      prisma.enquiry.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.enquiry.count({ where }),
    ])
    reply.send(success(data, undefined, paginate(total, page, limit)))
  })

  app.get('/enquiries/:id', { schema: swaggerSchemas.getEnquiry, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const enquiry = await prisma.enquiry.findUnique({ where: { id: parseId(req.params.id) } })
    if (!enquiry) throw new NotFoundError('Enquiry', req.params.id)
    reply.send(success(enquiry))
  })

  app.put('/enquiries/:id/status', { schema: swaggerSchemas.updateEnquiryStatus, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const dto = updateEnquiryStatusSchema.parse(req.body)
    const enquiry = await prisma.enquiry.update({
      where: { id: parseId(req.params.id) },
      data: { status: dto.status },
    })
    reply.send(success(enquiry, 'Enquiry status updated'))
  })
}

// ═══════════════════════════════════════════════════════════════
// FAQ
// ═══════════════════════════════════════════════════════════════

const createFaqSchema = z.object({
  category: z.nativeEnum(FaqCategory),
  question: z.string().min(1),
  answer: z.string().min(1),
  sortOrder: z.number().int().default(0),
})

export async function faqRoutes(app: FastifyInstance): Promise<void> {
  app.get('/faq', { schema: swaggerSchemas.listFaq }, async (req, reply) => {
    const redis = getRedis()
    const { category } = req.query as { category?: FaqCategory }
    const cacheKey = `faq:${category ?? 'all'}`

    const cached = await redis.get(cacheKey)
    if (cached) return reply.send(success(JSON.parse(cached)))

    const where = category ? { category } : {}
    const faqs = await prisma.faq.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    await redis.setex(cacheKey, 3600, JSON.stringify(faqs))
    reply.send(success(faqs))
  })

  app.post('/faq', { schema: swaggerSchemas.createFaq, preHandler: requireAdmin() }, async (req, reply) => {
    const dto = createFaqSchema.parse(req.body)
    const faq = await prisma.faq.create({ data: dto })
    await getRedis().del('faq:all', `faq:${faq.category}`)
    reply.status(201).send(success(faq, 'FAQ created'))
  })

  app.put('/faq/:id', { schema: swaggerSchemas.updateFaq, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const dto = createFaqSchema.partial().parse(req.body)
    const faq = await prisma.faq.update({ where: { id: parseId(req.params.id) }, data: dto })
    await getRedis().del('faq:all', `faq:${faq.category}`)
    reply.send(success(faq, 'FAQ updated'))
  })

  app.delete('/faq/:id', { schema: swaggerSchemas.deleteFaq, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    await prisma.faq.delete({ where: { id: parseId(req.params.id) } })
    reply.send(success(null, 'FAQ deleted'))
  })
}

// ═══════════════════════════════════════════════════════════════
// PROMOTIONS
// ═══════════════════════════════════════════════════════════════

const createPromotionSchema = z.object({
  title: z.string().min(1),
  discountPercent: z.number().int().min(1).max(100),
  maxSavings: z.number().positive().optional(),
  freeShippingThreshold: z.number().positive().optional(),
  itemsOnSale: z.number().int().positive().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  isActive: z.boolean().default(true),
})

export async function promotionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/promotions', { schema: swaggerSchemas.listPromotions }, async (_req, reply) => {
    const now = new Date()
    const promotions = await prisma.promotion.findMany({
      where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
      orderBy: { startAt: 'desc' },
    })
    reply.send(success(promotions))
  })

  app.get('/promotions/active', { schema: swaggerSchemas.getActivePromotion }, async (_req, reply) => {
    const redis = getRedis()
    const cached = await redis.get('promotion:active')
    if (cached) return reply.send(success(JSON.parse(cached)))

    const now = new Date()
    const promotion = await prisma.promotion.findFirst({
      where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
      orderBy: { discountPercent: 'desc' },
    })

    if (promotion) await redis.setex('promotion:active', 60, JSON.stringify(promotion))
    reply.send(success(promotion))
  })

  app.post('/promotions', { schema: swaggerSchemas.createPromotion, preHandler: requireAdmin() }, async (req, reply) => {
    const dto = createPromotionSchema.parse(req.body)
    const promotion = await prisma.promotion.create({ data: dto })
    await getRedis().del('promotion:active')
    reply.status(201).send(success(promotion, 'Promotion created'))
  })

  app.put('/promotions/:id', { schema: swaggerSchemas.updatePromotion, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const dto = createPromotionSchema.partial().parse(req.body)
    const promotion = await prisma.promotion.update({ where: { id: parseId(req.params.id) }, data: dto })
    await getRedis().del('promotion:active')
    reply.send(success(promotion, 'Promotion updated'))
  })

  app.delete('/promotions/:id', { schema: swaggerSchemas.deactivatePromotion, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    await prisma.promotion.update({ where: { id: parseId(req.params.id) }, data: { isActive: false } })
    await getRedis().del('promotion:active')
    reply.send(success(null, 'Promotion deactivated'))
  })
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER LOOKS
// ═══════════════════════════════════════════════════════════════

const submitLookSchema = z.object({
  customerName: z.string().min(1).max(100),
  imageUrl: z.string().url(),
  productId: z.number().int().positive().optional(),
})

export async function customerLookRoutes(app: FastifyInstance): Promise<void> {
  app.get('/customer-looks', { schema: swaggerSchemas.listCustomerLooks }, async (req, reply) => {
    const { page, limit } = parsePaginationQuery(req.query as Record<string, string>)
    const { skip, take } = getPaginationParams(page, limit)
    const [data, total] = await prisma.$transaction([
      prisma.customerLook.findMany({
        where: { isApproved: true },
        orderBy: { submittedAt: 'desc' },
        skip,
        take,
      }),
      prisma.customerLook.count({ where: { isApproved: true } }),
    ])
    reply.send(success(data, undefined, paginate(total, page, limit)))
  })

  app.post('/customer-looks', { schema: swaggerSchemas.submitLook, preHandler: authenticateOptional }, async (req, reply) => {
    const dto = submitLookSchema.parse(req.body)
    const look = await prisma.customerLook.create({
      data: { ...dto, customerId: req.user?.sub },
    })
    reply.status(201).send(success(look, 'Look submitted for review'))
  })

  app.put('/customer-looks/:id/approve', { schema: swaggerSchemas.approveLook, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const look = await prisma.customerLook.update({
      where: { id: parseId(req.params.id) },
      data: { isApproved: true },
    })
    reply.send(success(look, 'Look approved'))
  })

  app.delete('/customer-looks/:id', { schema: swaggerSchemas.deleteLook, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    await prisma.customerLook.delete({ where: { id: parseId(req.params.id) } })
    reply.send(success(null, 'Look removed'))
  })
}

// ═══════════════════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════════════════

const addCartItemSchema = z.object({
  productId: z.number().int().positive().optional(),
  bundleId: z.number().int().positive().optional(),
  size: z.string().optional(),
  quantity: z.number().int().positive().default(1),
}).refine((d) => d.productId || d.bundleId, 'productId or bundleId required')

const CART_SELECT = {
  id: true,
  sessionId: true,
  customerId: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      quantity: true,
      size: true,
      product: { select: { id: true, name: true, price: true, images: { where: { isPrimary: true }, take: 1 } } },
      bundle: { select: { id: true, name: true, price: true } },
    },
  },
}

export async function cartRoutes(app: FastifyInstance): Promise<void> {
  app.get('/cart/:sessionId', { schema: swaggerSchemas.getCart }, async (req: FastifyRequest<{ Params: { sessionId: string } }>, reply) => {
    const cart = await prisma.cartSession.findUnique({
      where: { sessionId: req.params.sessionId },
      select: CART_SELECT,
    })
    if (!cart) {
      // Return empty cart
      return reply.send(success({ sessionId: req.params.sessionId, items: [] }))
    }
    reply.send(success(cart))
  })

  app.post('/cart/:sessionId/items', { schema: swaggerSchemas.addCartItem }, async (req: FastifyRequest<{ Params: { sessionId: string } }>, reply) => {
    const dto = addCartItemSchema.parse(req.body)

    // Upsert session
    let session = await prisma.cartSession.findUnique({ where: { sessionId: req.params.sessionId } })
    if (!session) {
      session = await prisma.cartSession.create({ data: { sessionId: req.params.sessionId } })
    }

    // Check if same item+size already in cart → increment qty
    const existing = await prisma.cartItem.findFirst({
      where: {
        cartId: session.id,
        productId: dto.productId ?? null,
        bundleId: dto.bundleId ?? null,
        size: dto.size ?? null,
      },
    })

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: dto.quantity } },
      })
    } else {
      await prisma.cartItem.create({ data: { cartId: session.id, ...dto } })
    }

    const cart = await prisma.cartSession.findUnique({ where: { id: session.id }, select: CART_SELECT })
    reply.status(201).send(success(cart, 'Item added to cart'))
  })

  app.put('/cart/:sessionId/items/:itemId', { schema: swaggerSchemas.updateCartItem }, async (req: FastifyRequest<{ Params: { sessionId: string; itemId: string } }>, reply) => {
    const { quantity } = z.object({ quantity: z.number().int().positive() }).parse(req.body)
    await prisma.cartItem.update({ where: { id: parseId(req.params.itemId) }, data: { quantity } })
    const cart = await prisma.cartSession.findUnique({ where: { sessionId: req.params.sessionId }, select: CART_SELECT })
    reply.send(success(cart, 'Cart updated'))
  })

  app.delete('/cart/:sessionId/items/:itemId', { schema: swaggerSchemas.removeCartItem }, async (req: FastifyRequest<{ Params: { sessionId: string; itemId: string } }>, reply) => {
    await prisma.cartItem.delete({ where: { id: parseId(req.params.itemId) } })
    reply.send(success(null, 'Item removed'))
  })

  app.delete('/cart/:sessionId', { schema: swaggerSchemas.clearCart }, async (req: FastifyRequest<{ Params: { sessionId: string } }>, reply) => {
    const session = await prisma.cartSession.findUnique({ where: { sessionId: req.params.sessionId } })
    if (session) await prisma.cartItem.deleteMany({ where: { cartId: session.id } })
    reply.send(success(null, 'Cart cleared'))
  })
}

// ═══════════════════════════════════════════════════════════════
// BUNDLES
// ═══════════════════════════════════════════════════════════════

const createBundleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  isLimited: z.boolean().default(false),
  imageUrl: z.string().url().optional(),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    size: z.string().optional(),
    quantity: z.number().int().positive().default(1),
  })).optional(),
})

export async function bundleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/bundles', { schema: swaggerSchemas.listBundles }, async (_req, reply) => {
    const bundles = await prisma.bundle.findMany({
      where: { deletedAt: null },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    reply.send(success(bundles))
  })

  app.get('/bundles/:id', { schema: swaggerSchemas.getBundle }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const bundle = await prisma.bundle.findFirst({
      where: { id: parseId(req.params.id), deletedAt: null },
      include: { items: { include: { product: true } } },
    })
    if (!bundle) throw new NotFoundError('Bundle', req.params.id)
    reply.send(success(bundle))
  })

  app.post('/bundles', { schema: swaggerSchemas.createBundle, preHandler: requireAdmin() }, async (req, reply) => {
    const { items, ...data } = createBundleSchema.parse(req.body)
    const bundle = await prisma.bundle.create({
      data: { ...data, ...(items && { items: { create: items } }) },
      include: { items: true },
    })
    reply.status(201).send(success(bundle, 'Bundle created'))
  })

  app.put('/bundles/:id', { schema: swaggerSchemas.updateBundle, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { items, ...data } = createBundleSchema.partial().parse(req.body)
    const bundle = await prisma.bundle.update({
      where: { id: parseId(req.params.id) },
      data: {
        ...data,
        ...(items && { items: { deleteMany: {}, create: items } }),
      },
      include: { items: true },
    })
    reply.send(success(bundle, 'Bundle updated'))
  })

  app.delete('/bundles/:id', { schema: swaggerSchemas.deleteBundle, preHandler: requireAdmin() }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    await prisma.bundle.update({ where: { id: parseId(req.params.id) }, data: { deletedAt: new Date() } })
    reply.send(success(null, 'Bundle deleted'))
  })
}
