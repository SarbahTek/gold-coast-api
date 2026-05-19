import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import multipart from '@fastify/multipart'
import { uploadImage } from '../../shared/utils/cloudinary'
import { prisma } from '../../config/database'
import { requireAdmin, authenticateOptional } from '../../shared/middleware/auth.middleware'
import { success } from '../../shared/types/response'
import { ValidationError } from '../../shared/errors/AppError'
import { parseId } from '../../shared/utils/pagination'
import { swaggerSchemas } from '../../config/swagger'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, { limits: { fileSize: MAX_SIZE } })

  app.post<{ Params: { id: string } }>(
    '/products/:id/images',
    { schema: swaggerSchemas.uploadProductImage, preHandler: requireAdmin() },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = await req.file()
      if (!data) throw new ValidationError('No file provided')
      if (!ALLOWED_TYPES.includes(data.mimetype)) {
        throw new ValidationError('Only JPEG, PNG, and WebP images are allowed')
      }

      const buffer = await data.toBuffer()
      const result = await uploadImage(buffer, 'products')

      const image = await prisma.productImage.create({
        data: {
          productId: parseId(req.params.id),
          imageUrl: result.url,
          isPrimary: false,
          sortOrder: 99,
        },
      })

      reply.status(201).send(success(image, 'Image uploaded'))
    },
  )

  app.post(
    '/customer-looks/upload',
    { schema: swaggerSchemas.uploadLookImage, preHandler: authenticateOptional },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const data = await req.file()
      if (!data) throw new ValidationError('No file provided')
      if (!ALLOWED_TYPES.includes(data.mimetype)) {
        throw new ValidationError('Only JPEG, PNG, and WebP images are allowed')
      }

      const buffer = await data.toBuffer()
      const result = await uploadImage(buffer, 'customer-looks')

      reply.send(success({ url: result.url }, 'Image uploaded'))
    },
  )
}
