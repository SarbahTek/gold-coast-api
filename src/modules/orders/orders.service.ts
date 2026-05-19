import { z } from 'zod'
import { Prisma, OrderStatus } from '@prisma/client'
import { prisma } from '../../config/database'
import { NotFoundError, UnprocessableError, ForbiddenError } from '../../shared/errors/AppError'
import { getPaginationParams, paginate, PaginationMeta } from '../../shared/types/response'
import { generateOrderNumber } from '../../shared/utils/generators'

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const createOrderSchema = z.object({
  customerId: z.number().int().positive().optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  shippingAddress: z.string().min(1),
  phone: z.string().min(1),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive().optional(),
        bundleId: z.number().int().positive().optional(),
        size: z.string().optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1)
    .refine(
      (items) => items.every((i) => i.productId || i.bundleId),
      'Each item must have a productId or bundleId',
    ),
})

export const trackOrderSchema = z.object({
  orderNumber: z.string().regex(/^GCH-\d{4}-\d{6}$/, 'Invalid order number format'),
  phone: z.string().min(7),
})

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
})

export const listOrdersSchema = z.object({
  page: z.string().optional().transform(Number).pipe(z.number().int().positive().default(1)),
  limit: z.string().optional().transform(Number).pipe(z.number().int().min(1).max(100).default(20)),
  status: z.nativeEnum(OrderStatus).optional(),
  customerId: z.string().optional().transform(Number).pipe(z.number().int().positive().optional()),
})

export type CreateOrderDto = z.infer<typeof createOrderSchema>
export type TrackOrderDto = z.infer<typeof trackOrderSchema>
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>
export type ListOrdersDto = z.infer<typeof listOrdersSchema>

// ─── Select shape ─────────────────────────────────────────────────────────────

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  customerId: true,
  guestEmail: true,
  guestPhone: true,
  status: true,
  totalAmount: true,
  shippingAddress: true,
  phone: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      size: true,
      quantity: true,
      unitPrice: true,
      subtotal: true,
      product: { select: { id: true, name: true, images: { where: { isPrimary: true }, take: 1 } } },
      bundle: { select: { id: true, name: true, imageUrl: true } },
    },
  },
  payments: {
    select: { id: true, provider: true, amount: true, status: true, createdAt: true },
  },
} satisfies Prisma.OrderSelect

// ─── Place Order ──────────────────────────────────────────────────────────────

export async function placeOrder(dto: CreateOrderDto) {
  // Validate at least guest info or customer
  if (!dto.customerId && !dto.guestEmail && !dto.guestPhone) {
    throw new UnprocessableError('Guest email or phone is required for guest orders')
  }

  // Resolve prices and stock in a transaction
  return prisma.$transaction(async (tx) => {
    let totalAmount = new Prisma.Decimal(0)

    const resolvedItems: {
      productId?: number
      bundleId?: number
      size?: string
      quantity: number
      unitPrice: Prisma.Decimal
      subtotal: Prisma.Decimal
    }[] = []

    for (const item of dto.items) {
      if (item.productId) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, deletedAt: null },
          select: { id: true, price: true, stockQty: true, name: true },
        })

        if (!product) throw new NotFoundError('Product', item.productId)
        if (product.stockQty < item.quantity) {
          throw new UnprocessableError(
            `Insufficient stock for product '${product.name}'. Available: ${product.stockQty}`,
          )
        }

        const unitPrice = product.price
        const subtotal = unitPrice.mul(item.quantity)
        totalAmount = totalAmount.add(subtotal)

        resolvedItems.push({
          productId: item.productId,
          size: item.size,
          quantity: item.quantity,
          unitPrice,
          subtotal,
        })

        // Decrement stock
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        })
      }

      if (item.bundleId) {
        const bundle = await tx.bundle.findFirst({
          where: { id: item.bundleId, deletedAt: null },
          select: { id: true, price: true, name: true },
        })

        if (!bundle) throw new NotFoundError('Bundle', item.bundleId)

        const unitPrice = bundle.price
        const subtotal = unitPrice.mul(item.quantity)
        totalAmount = totalAmount.add(subtotal)

        resolvedItems.push({
          bundleId: item.bundleId,
          quantity: item.quantity,
          unitPrice,
          subtotal,
        })
      }
    }

    const orderNumber = generateOrderNumber()

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: dto.customerId,
        guestEmail: dto.guestEmail,
        guestPhone: dto.guestPhone,
        shippingAddress: dto.shippingAddress,
        phone: dto.phone,
        notes: dto.notes,
        totalAmount,
        items: { create: resolvedItems },
      },
      select: ORDER_SELECT,
    })

    return order
  })
}

// ─── Track Order ──────────────────────────────────────────────────────────────

export async function trackOrder(dto: TrackOrderDto) {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: dto.orderNumber,
      deletedAt: null,
      OR: [{ phone: dto.phone }, { guestPhone: dto.phone }],
    },
    select: {
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          quantity: true,
          size: true,
          product: { select: { name: true } },
          bundle: { select: { name: true } },
        },
      },
    },
  })

  if (!order) throw new NotFoundError('Order')

  return order
}

type OrderWithDetails = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>

// ─── List Orders (admin) ──────────────────────────────────────────────────────

export async function listOrders(
  query: ListOrdersDto,
): Promise<{ data: OrderWithDetails[]; meta: PaginationMeta }> {
  const { page, limit, skip, take } = getPaginationParams(query.page, query.limit)

  const where: Prisma.OrderWhereInput = {
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.customerId && { customerId: query.customerId }),
  }

  const [data, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      select: ORDER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ])

  return { data, meta: paginate(total, page, limit) }
}

// ─── Get Order ────────────────────────────────────────────────────────────────

export async function getOrder(id: number) {
  const order = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    select: ORDER_SELECT,
  })

  if (!order) throw new NotFoundError('Order', id)
  return order
}

// ─── Update Status ────────────────────────────────────────────────────────────

export async function updateOrderStatus(
  id: number,
  dto: UpdateOrderStatusDto,
  adminId: number,
) {
  const order = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true },
  })

  if (!order) throw new NotFoundError('Order', id)

  // Guard: cannot re-open a delivered order
  if (order.status === 'delivered' && dto.status === 'pending') {
    throw new UnprocessableError('Cannot revert a delivered order to pending')
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: dto.status },
    select: ORDER_SELECT,
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminUserId: adminId,
      action: 'UPDATE_ORDER_STATUS',
      resource: 'orders',
      resourceId: String(id),
      payload: { from: order.status, to: dto.status },
    },
  })

  return updated
}

// ─── Cancel Order ─────────────────────────────────────────────────────────────

export async function cancelOrder(id: number, requesterId?: number, isAdmin = false) {
  const order = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, customerId: true },
  })

  if (!order) throw new NotFoundError('Order', id)

  if (!isAdmin) {
    if (order.customerId !== requesterId) throw new ForbiddenError()
    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new UnprocessableError('Only pending or confirmed orders can be cancelled')
    }
  }

  return prisma.order.update({
    where: { id },
    data: { status: 'cancelled' },
    select: ORDER_SELECT,
  })
}
