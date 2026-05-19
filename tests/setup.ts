import { prisma } from '../src/config/database'
import { beforeAll, afterAll, beforeEach } from 'vitest'

beforeAll(async () => {
  // Ensure test DB is connected
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})

// Clean DB between tests (in test env only)
beforeEach(async () => {
  if (process.env['NODE_ENV'] !== 'test') return

  // Delete in FK-safe order
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.adminRefreshToken.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.paymentTransaction.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cartSession.deleteMany(),
    prisma.review.deleteMany(),
    prisma.customerLook.deleteMany(),
    prisma.bundleItem.deleteMany(),
    prisma.bundle.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productSize.deleteMany(),
    prisma.product.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.adminUser.deleteMany(),
    prisma.enquiry.deleteMany(),
    prisma.faq.deleteMany(),
    prisma.promotion.deleteMany(),
  ])
})
