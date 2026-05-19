import { FastifyRequest, FastifyReply } from 'fastify'
import {
  listProducts,
  getProduct,
  getFeaturedProducts,
  getSaleProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
} from './products.service'
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from './products.schema'
import { success } from '../../shared/types/response'
import { parseId } from '../../shared/utils/pagination'

export async function listProductsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const query = productQuerySchema.parse(request.query)
  const result = await listProducts(query)
  reply.send(success(result.data, undefined, result.meta))
}

export async function getProductController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const id = parseId(request.params.id)
  const product = await getProduct(id)
  reply.send(success(product))
}

export async function getFeaturedController(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const products = await getFeaturedProducts()
  reply.send(success(products))
}

export async function getSaleController(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const products = await getSaleProducts()
  reply.send(success(products))
}

export async function getCategoriesController(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const categories = await getCategories()
  reply.send(success(categories))
}

export async function createProductController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const dto = createProductSchema.parse(request.body)
  const product = await createProduct(dto)
  reply.status(201).send(success(product, 'Product created'))
}

export async function updateProductController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const id = parseId(request.params.id)
  const dto = updateProductSchema.parse(request.body)
  const product = await updateProduct(id, dto)
  reply.send(success(product, 'Product updated'))
}

export async function deleteProductController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const id = parseId(request.params.id)
  await deleteProduct(id)
  reply.send(success(null, 'Product deleted'))
}
