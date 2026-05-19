import { z } from 'zod'
import { ProductCategory, ProductSubcategory } from '@prisma/client'

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.nativeEnum(ProductCategory),
  subcategory: z.nativeEnum(ProductSubcategory).default('other'),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  isOnSale: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  stockQty: z.number().int().min(0).default(0),
  sizes: z
    .array(z.object({ size: z.string(), stockQty: z.number().int().min(0) }))
    .optional(),
})

export const updateProductSchema = createProductSchema.partial()

export const productQuerySchema = z.object({
  page: z.string().optional().transform(Number).pipe(z.number().int().positive().default(1)),
  limit: z.string().optional().transform(Number).pipe(z.number().int().min(1).max(100).default(20)),
  category: z.nativeEnum(ProductCategory).optional(),
  subcategory: z.nativeEnum(ProductSubcategory).optional(),
  sort: z
    .enum(['price_asc', 'price_desc', 'newest', 'biggest_savings', 'featured'])
    .optional()
    .default('newest'),
  onSale: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  featured: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  newArrival: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  search: z.string().optional(),
})

export type CreateProductDto = z.infer<typeof createProductSchema>
export type UpdateProductDto = z.infer<typeof updateProductSchema>
export type ProductQueryDto = z.infer<typeof productQuerySchema>
