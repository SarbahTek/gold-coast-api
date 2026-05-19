import { Prisma, ProductCategory, ProductSubcategory } from '@prisma/client'
import { prisma } from '../../config/database'
import { getRedis } from '../../config/redis'
import { NotFoundError } from '../../shared/errors/AppError'
import { getPaginationParams, paginate, PaginationMeta } from '../../shared/types/response'
import type {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
} from './products.schema'

const CACHE_TTL = 300 // 5 minutes
const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  subcategory: true,
  price: true,
  originalPrice: true,
  discountPercent: true,
  isOnSale: true,
  isFeatured: true,
  isNewArrival: true,
  stockQty: true,
  createdAt: true,
  images: {
    orderBy: { sortOrder: 'asc' as const },
    select: { id: true, imageUrl: true, isPrimary: true, sortOrder: true },
  },
  sizes: {
    select: { id: true, size: true, stockQty: true },
  },
  _count: { select: { reviews: true } },
} satisfies Prisma.ProductSelect

type ProductWithRelations = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listProducts(query: ProductQueryDto): Promise<{
  data: ProductWithRelations[]
  meta: PaginationMeta
}> {
  const { page, limit, skip, take } = getPaginationParams(query.page, query.limit)

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(query.category && { category: query.category }),
    ...(query.subcategory && { subcategory: query.subcategory }),
    ...(query.onSale && { isOnSale: true }),
    ...(query.featured && { isFeatured: true }),
    ...(query.newArrival && { isNewArrival: true }),
    ...(query.search && {
      name: { contains: query.search, mode: 'insensitive' },
    }),
  }

  const orderBy = buildOrderBy(query.sort)

  const [data, total] = await prisma.$transaction([
    prisma.product.findMany({ where, select: PRODUCT_SELECT, orderBy, skip, take }),
    prisma.product.count({ where }),
  ])

  return { data, meta: paginate(total, page, limit) }
}

// ─── Get One ──────────────────────────────────────────────────────────────────

export async function getProduct(id: number): Promise<ProductWithRelations> {
  const redis = getRedis()
  const cacheKey = `product:${id}`

  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as ProductWithRelations

  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: PRODUCT_SELECT,
  })

  if (!product) throw new NotFoundError('Product', id)

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(product))

  return product
}

// ─── Get Featured ─────────────────────────────────────────────────────────────

export async function getFeaturedProducts(): Promise<ProductWithRelations[]> {
  const redis = getRedis()
  const cacheKey = 'products:featured'

  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as ProductWithRelations[]

  const products = await prisma.product.findMany({
    where: { isFeatured: true, deletedAt: null },
    select: PRODUCT_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 12,
  })

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(products))

  return products
}

// ─── Get Sale ─────────────────────────────────────────────────────────────────

export async function getSaleProducts(): Promise<ProductWithRelations[]> {
  const redis = getRedis()
  const cacheKey = 'products:sale'

  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as ProductWithRelations[]

  const products = await prisma.product.findMany({
    where: { isOnSale: true, deletedAt: null },
    select: PRODUCT_SELECT,
    orderBy: { discountPercent: 'desc' },
  })

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(products))

  return products
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createProduct(
  dto: CreateProductDto,
): Promise<ProductWithRelations> {
  const { sizes, ...productData } = dto

  const product = await prisma.product.create({
    data: {
      ...productData,
      price: productData.price,
      originalPrice: productData.originalPrice,
      ...(sizes && {
        sizes: {
          create: sizes,
        },
      }),
    },
    select: PRODUCT_SELECT,
  })

  await invalidateProductCache()

  return product
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateProduct(
  id: number,
  dto: UpdateProductDto,
): Promise<ProductWithRelations> {
  const { sizes, ...productData } = dto

  // Prisma throws P2025 if the record doesn't exist — caught as 404 by error handler
  const product = await prisma.product.update({
    where: { id, deletedAt: null },
    data: {
      ...productData,
      ...(sizes && {
        sizes: {
          deleteMany: {},
          create: sizes,
        },
      }),
    },
    select: PRODUCT_SELECT,
  })

  await invalidateProductCache(id)

  return product
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteProduct(id: number): Promise<void> {
  await prisma.product.update({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  await invalidateProductCache(id)
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(): Promise<{ category: ProductCategory; count: number }[]> {
  const results = await prisma.product.groupBy({
    by: ['category'],
    where: { deletedAt: null },
    _count: { category: true },
  })

  return results.map((r) => ({ category: r.category, count: r._count.category }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildOrderBy(
  sort?: string,
): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case 'price_asc':
      return { price: 'asc' }
    case 'price_desc':
      return { price: 'desc' }
    case 'biggest_savings':
      return { discountPercent: 'desc' }
    case 'featured':
      return { isFeatured: 'desc' }
    case 'newest':
    default:
      return { createdAt: 'desc' }
  }
}

async function invalidateProductCache(id?: number): Promise<void> {
  const redis = getRedis()
  const keys = ['products:featured', 'products:sale']
  if (id) keys.push(`product:${id}`)
  if (keys.length) await redis.del(...keys)
}
