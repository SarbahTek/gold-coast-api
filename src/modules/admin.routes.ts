import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { AdminRole } from '@prisma/client'
import { prisma } from '../config/database'
import { success, getPaginationParams, paginate } from '../shared/types/response'
import { requireAdmin, authenticate } from '../shared/middleware/auth.middleware'
import { NotFoundError, ConflictError, ForbiddenError } from '../shared/errors/AppError'
import { env } from '../config/env'
import { parsePaginationQuery, parseId } from '../shared/utils/pagination'
import { swaggerSchemas } from '../config/swagger'

// ═══════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════

const createAdminSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(AdminRole).default('support'),
})

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Dashboard stats
  app.get('/admin/dashboard', { schema: swaggerSchemas.dashboard, preHandler: requireAdmin() }, async (_req, reply) => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalOrders,
      monthOrders,
      pendingOrders,
      totalRevenue,
      monthRevenue,
      totalProducts,
      lowStockProducts,
      totalCustomers,
      newEnquiries,
      pendingLooks,
    ] = await prisma.$transaction([
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { deletedAt: null, createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { status: 'pending', deletedAt: null } }),
      prisma.order.aggregate({
        where: { status: { in: ['confirmed', 'processing', 'shipped', 'delivered'] } },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfMonth }, status: { in: ['confirmed', 'processing', 'shipped', 'delivered'] } },
        _sum: { totalAmount: true },
      }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null, stockQty: { lte: 5 } } }),
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.enquiry.count({ where: { status: 'new' } }),
      prisma.customerLook.count({ where: { isApproved: false } }),
    ])

    reply.send(success({
      orders: { total: totalOrders, thisMonth: monthOrders, pending: pendingOrders },
      revenue: {
        total: totalRevenue._sum.totalAmount ?? 0,
        thisMonth: monthRevenue._sum.totalAmount ?? 0,
      },
      products: { total: totalProducts, lowStock: lowStockProducts },
      customers: { total: totalCustomers },
      enquiries: { unread: newEnquiries },
      customerLooks: { pendingApproval: pendingLooks },
    }))
  })

  // Admin user management (superadmin only)
  app.get('/admin/users', { schema: swaggerSchemas.listAdminUsers, preHandler: requireAdmin(['superadmin'] as AdminRole[]) }, async (_req, reply) => {
    const admins = await prisma.adminUser.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    reply.send(success(admins))
  })

  app.post('/admin/users', { schema: swaggerSchemas.createAdminUser, preHandler: requireAdmin(['superadmin'] as AdminRole[]) }, async (req, reply) => {
    const dto = createAdminSchema.parse(req.body)
    const existing = await prisma.adminUser.findFirst({ where: { email: dto.email } })
    if (existing) throw new ConflictError('Admin with this email already exists')

    const passwordHash = await bcrypt.hash(dto.password, env.BCRYPT_ROUNDS)
    const admin = await prisma.adminUser.create({
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    reply.status(201).send(success(admin, 'Admin user created'))
  })

  // Audit logs
  app.get('/admin/audit-logs', { schema: swaggerSchemas.listAuditLogs, preHandler: requireAdmin(['superadmin'] as AdminRole[]) }, async (req, reply) => {
    const { page, limit } = parsePaginationQuery(req.query as Record<string, string>, 50)
    const { skip, take } = getPaginationParams(page, limit)

    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { adminUser: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count(),
    ])

    reply.send(success(data, undefined, paginate(total, page, limit)))
  })
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════

const updateCustomerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
})

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/customers/:id', { schema: swaggerSchemas.getCustomer, preHandler: authenticate }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const id = parseId(req.params.id)
    if (req.user?.type === 'customer' && req.user.sub !== id) {
      throw new ForbiddenError()
    }

    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true },
    })
    if (!customer) throw new NotFoundError('Customer', id)
    reply.send(success(customer))
  })

  app.put('/customers/:id', { schema: swaggerSchemas.updateCustomer, preHandler: authenticate }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const id = parseId(req.params.id)
    if (req.user?.type === 'customer' && req.user.sub !== id) {
      throw new ForbiddenError()
    }

    const dto = updateCustomerSchema.parse(req.body)
    const customer = await prisma.customer.update({
      where: { id },
      data: dto,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    })
    reply.send(success(customer, 'Profile updated'))
  })

  app.get('/customers/:id/orders', { schema: swaggerSchemas.getCustomerOrders, preHandler: authenticate }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const id = parseId(req.params.id)
    if (req.user?.type === 'customer' && req.user.sub !== id) {
      throw new ForbiddenError()
    }

    const { page, limit } = parsePaginationQuery(req.query as Record<string, string>, 10)
    const { skip, take } = getPaginationParams(page, limit)

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where: { customerId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          items: { select: { quantity: true, product: { select: { name: true } }, bundle: { select: { name: true } } } },
        },
      }),
      prisma.order.count({ where: { customerId: id, deletedAt: null } }),
    ])

    reply.send(success(orders, undefined, paginate(total, page, limit)))
  })
}
