import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import swagger, { FastifyDynamicSwaggerOptions } from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { env } from './env'

// ─────────────────────────────────────────────────────────────
// Base reusable schemas
// ─────────────────────────────────────────────────────────────


const ApiResponse = {
  type: 'object',

  required: ['success', 'message'],

  properties: {
    success: { type: 'boolean' },

    message: { type: 'string' },

    data: {
      type: ['object', 'array', 'null'],
    },

    error: {
      type: ['object', 'null'],

      properties: {
        code: { type: 'string' },

        message: { type: 'string' },

        details: {
          type: ['object', 'array', 'string', 'null'],
        },
      },
    },

    meta: {
      type: ['object', 'null'],

      properties: {
        total: { type: 'integer' },

        page: { type: 'integer' },

        limit: { type: 'integer' },

        totalPages: { type: 'integer' },

        hasNext: { type: 'boolean' },

        hasPrev: { type: 'boolean' },
      },
    },
  },
} as const

const ErrorResponse = {
  type: 'object',

  required: ['success', 'error'],

  properties: {
    success: {
      type: 'boolean',
      example: false,
    },

    error: {
      type: 'object',

      required: ['code', 'message'],

      properties: {
        code: { type: 'string' },

        message: { type: 'string' },
      },
    },
  },
} as const

const IdParam = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string' },
  },
} as const

const PaginationQuery = {
  type: 'object',
  properties: {
    page: {
      type: 'integer',
      default: 1,
      minimum: 1,
    },
    limit: {
      type: 'integer',
      default: 20,
      minimum: 1,
      maximum: 100,
    },
  },
} as const

// ─────────────────────────────────────────────────────────────
// Component schemas
// ─────────────────────────────────────────────────────────────

// Exported so app.ts can call app.addSchema() directly on the root
// Fastify instance before any plugin registration. This is required
// because app.register() is deferred — schemas added inside a plugin
// are not visible to AJV when sibling plugins compile their routes.
export const definitions: Record<string, any> = {
  RegisterBody: {
    $id: 'RegisterBody',
    type: 'object',
    additionalProperties: false,
    required: ['firstName', 'lastName', 'email', 'password'],
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      password: { type: 'string', minLength: 8 },
    },
  },

  LoginBody: {
    $id: 'LoginBody',
    type: 'object',
    additionalProperties: false,
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
  },

  RefreshBody: {
    $id: 'RefreshBody',
    type: 'object',
    additionalProperties: false,
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' },
    },
  },

  TokenResponse: {
    $id: 'TokenResponse',
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
    },
  },

  Product: {
    $id: 'Product',
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      price: { type: 'number' },
      stockQty: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  CreateProductBody: {
    $id: 'CreateProductBody',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'category', 'price'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      price: { type: 'number' },
      stockQty: { type: 'integer', default: 0 },
    },
  },

  Order: {
    $id: 'Order',
    type: 'object',
    properties: {
      id: { type: 'integer' },
      orderNumber: { type: 'string' },
      status: { type: 'string' },
      totalAmount: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  PlaceOrderBody: {
    $id: 'PlaceOrderBody',
    type: 'object',
    additionalProperties: false,
    required: ['shippingAddress', 'phone', 'items'],
    properties: {
      shippingAddress: { type: 'string' },
      phone: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'integer' },
            quantity: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
  },
}

// ─────────────────────────────────────────────────────────────
// Shared route schema helpers
// ─────────────────────────────────────────────────────────────

const defaultProtected = [{ bearerAuth: [] }] as const

const DefaultRouteResponse = {
  200: ApiResponse,
} as const

// ─────────────────────────────────────────────────────────────
// Route schemas
// ─────────────────────────────────────────────────────────────

export const swaggerSchemas = {
  // AUTH

  register: {
    tags: ['Auth'],
    summary: 'Register user',
    body: { $ref: 'RegisterBody#' },
    response: { 201: ApiResponse, 400: ErrorResponse },
  },

  login: {
    tags: ['Auth'],
    summary: 'Login user',
    body: { $ref: 'LoginBody#' },
    response: { 200: ApiResponse, 401: ErrorResponse },
  },

  refresh: {
    tags: ['Auth'],
    summary: 'Refresh access token',
    body: { $ref: 'RefreshBody#' },
    response: { 200: ApiResponse, 401: ErrorResponse },
  },

  logout: {
    tags: ['Auth'],
    summary: 'Logout user',
    body: { $ref: 'RefreshBody#' },
    security: defaultProtected,
    response: { 200: ApiResponse, 401: ErrorResponse },
  },

  adminLogin: {
    tags: ['Auth'],
    summary: 'Admin login',
    body: { $ref: 'LoginBody#' },
    response: { 200: ApiResponse, 401: ErrorResponse },
  },

  // PRODUCTS

  listProducts: {
    tags: ['Products'],
    summary: 'List products',
    querystring: PaginationQuery,
    response: { 200: ApiResponse },
  },

  getProduct: {
    tags: ['Products'],
    summary: 'Get product',
    params: IdParam,
    response: { 200: ApiResponse, 404: ErrorResponse },
  },

  createProduct: {
    tags: ['Products'],
    summary: 'Create product',
    security: defaultProtected,
    body: { $ref: 'CreateProductBody#' },
    response: { 201: ApiResponse, 400: ErrorResponse },
  },

  updateProduct: {
    tags: ['Products'],
    summary: 'Update product',
    security: defaultProtected,
    params: IdParam,
    body: { $ref: 'CreateProductBody#' },
    response: { 200: ApiResponse, 404: ErrorResponse },
  },

  deleteProduct: {
    tags: ['Products'],
    summary: 'Delete product',
    security: defaultProtected,
    params: IdParam,
    response: { 200: ApiResponse, 404: ErrorResponse },
  },

  getFeatured: { tags: ['Products'], summary: 'Get featured products', response: DefaultRouteResponse },
  getSale: { tags: ['Products'], summary: 'Get sale products', response: DefaultRouteResponse },
  getCategories: { tags: ['Products'], summary: 'Get product categories', response: DefaultRouteResponse },

  // ORDERS

  placeOrder: {
    tags: ['Orders'],
    summary: 'Place order',
    body: { $ref: 'PlaceOrderBody#' },
    response: { 201: ApiResponse, 400: ErrorResponse },
  },

  listOrders: {
    tags: ['Orders'],
    summary: 'List orders',
    security: defaultProtected,
    querystring: PaginationQuery,
    response: DefaultRouteResponse,
  },

  getOrder: {
    tags: ['Orders'],
    summary: 'Get order',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  trackOrder: {
    tags: ['Orders'],
    summary: 'Track order',
    response: DefaultRouteResponse,
  },

  cancelOrder: {
    tags: ['Orders'],
    summary: 'Cancel order',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  updateOrderStatus: {
    tags: ['Orders'],
    summary: 'Update order status',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  // REVIEWS

  listReviews: {
    tags: ['Reviews'],
    summary: 'List reviews',
    response: DefaultRouteResponse,
  },

  reviewSummary: {
    tags: ['Reviews'],
    summary: 'Review summary',
    response: DefaultRouteResponse,
  },

  createReview: {
    tags: ['Reviews'],
    summary: 'Create review',
    response: DefaultRouteResponse,
  },

  deleteReview: {
    tags: ['Reviews'],
    summary: 'Delete review',
    params: IdParam,
    response: DefaultRouteResponse,
  },

  // ADMIN

  dashboard: {
    tags: ['Admin'],
    summary: 'Admin dashboard',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  listAdminUsers: {
    tags: ['Admin'],
    summary: 'List admin users',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  createAdminUser: {
    tags: ['Admin'],
    summary: 'Create admin user',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  listAuditLogs: {
    tags: ['Admin'],
    summary: 'List audit logs',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  // CUSTOMERS

  getCustomer: {
    tags: ['Customers'],
    summary: 'Get customer',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  updateCustomer: {
    tags: ['Customers'],
    summary: 'Update customer',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  getCustomerOrders: {
    tags: ['Customers'],
    summary: 'Get customer orders',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  // SHARED

  createEnquiry: {
    tags: ['Enquiries'],
    summary: 'Create enquiry',
    response: DefaultRouteResponse,
  },

  listEnquiries: {
    tags: ['Enquiries'],
    summary: 'List enquiries',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  getEnquiry: {
    tags: ['Enquiries'],
    summary: 'Get enquiry',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  updateEnquiryStatus: {
    tags: ['Enquiries'],
    summary: 'Update enquiry status',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  listFaq: {
    tags: ['FAQ'],
    summary: 'List FAQ',
    response: DefaultRouteResponse,
  },

  createFaq: {
    tags: ['FAQ'],
    summary: 'Create FAQ',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  updateFaq: {
    tags: ['FAQ'],
    summary: 'Update FAQ',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  deleteFaq: {
    tags: ['FAQ'],
    summary: 'Delete FAQ',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  listPromotions: {
    tags: ['Promotions'],
    summary: 'List promotions',
    response: DefaultRouteResponse,
  },

  getActivePromotion: {
    tags: ['Promotions'],
    summary: 'Get active promotion',
    response: DefaultRouteResponse,
  },

  createPromotion: {
    tags: ['Promotions'],
    summary: 'Create promotion',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  updatePromotion: {
    tags: ['Promotions'],
    summary: 'Update promotion',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  deactivatePromotion: {
    tags: ['Promotions'],
    summary: 'Deactivate promotion',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  listCustomerLooks: {
    tags: ['Customer Looks'],
    summary: 'List customer looks',
    response: DefaultRouteResponse,
  },

  submitLook: {
    tags: ['Customer Looks'],
    summary: 'Submit customer look',
    response: DefaultRouteResponse,
  },

  approveLook: {
    tags: ['Customer Looks'],
    summary: 'Approve customer look',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  deleteLook: {
    tags: ['Customer Looks'],
    summary: 'Delete customer look',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  getCart: {
    tags: ['Cart'],
    summary: 'Get cart',
    response: DefaultRouteResponse,
  },

  addCartItem: {
    tags: ['Cart'],
    summary: 'Add cart item',
    response: DefaultRouteResponse,
  },

  updateCartItem: {
    tags: ['Cart'],
    summary: 'Update cart item',
    response: DefaultRouteResponse,
  },

  removeCartItem: {
    tags: ['Cart'],
    summary: 'Remove cart item',
    response: DefaultRouteResponse,
  },

  clearCart: {
    tags: ['Cart'],
    summary: 'Clear cart',
    response: DefaultRouteResponse,
  },

  listBundles: {
    tags: ['Bundles'],
    summary: 'List bundles',
    response: DefaultRouteResponse,
  },

  getBundle: {
    tags: ['Bundles'],
    summary: 'Get bundle',
    params: IdParam,
    response: DefaultRouteResponse,
  },

  createBundle: {
    tags: ['Bundles'],
    summary: 'Create bundle',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  updateBundle: {
    tags: ['Bundles'],
    summary: 'Update bundle',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  deleteBundle: {
    tags: ['Bundles'],
    summary: 'Delete bundle',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  // HEALTH

  health: {
    tags: ['Health'],
    summary: 'Health check',
    response: {
      200: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
          },
        },
      },
    },
  },

  healthDetailed: {
    tags: ['Health'],
    summary: 'Detailed health check',
    response: DefaultRouteResponse,
  },

  healthReady: {
    tags: ['Health'],
    summary: 'Readiness check',
    response: DefaultRouteResponse,
  },

  // WEBHOOKS

  paystackWebhook: {
    tags: ['Webhooks'],
    summary: 'Paystack webhook',
    response: {
      200: {
        type: 'object',
        properties: {
          received: {
            type: 'boolean',
          },
        },
      },
    },
  },

  // UPLOADS

  uploadProductImage: {
    tags: ['Uploads'],
    summary: 'Upload product image',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  uploadLookImage: {
    tags: ['Uploads'],
    summary: 'Upload look image',
    response: DefaultRouteResponse,
  },
}

// ─────────────────────────────────────────────────────────────
// Swagger plugin
// ─────────────────────────────────────────────────────────────

async function swaggerPluginFn(
  app: FastifyInstance
): Promise<void> {

  // Schemas are registered on the root app instance in app.ts before this
  // plugin loads. addSchema() must be called directly on the root — not
  // inside a plugin — so AJV has them available when routes compile.

  const swaggerOptions: FastifyDynamicSwaggerOptions = {
    openapi: {
      openapi: '3.0.3',

      info: {
        title: 'Gold Coast Hair API',
        version: '1.0.0',
        description: [
          'Production API for Gold Coast Hair.',
          '',
          '**Auth:** `POST /api/v1/auth/login` → copy `accessToken` → click **Authorize** → paste `Bearer <token>`',
          '',
          'Tokens expire in **15 minutes**. Renew with `POST /api/v1/auth/refresh`.',
        ].join('\n'),
      },

      servers: [
        {
          url:
            env.NODE_ENV === 'production'
              ? 'https://your-app.railway.app'
              : `http://localhost:${env.PORT}`,
        },
      ],

      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },

      // FIX 3: Every tag name used in swaggerSchemas must be declared here.
      // Any route whose tag is not listed gets silently dropped from the UI.
      tags: [
        { name: 'Auth' },
        { name: 'Products' },
        { name: 'Bundles' },
        { name: 'Cart' },
        { name: 'Orders' },
        { name: 'Reviews' },
        { name: 'Enquiries' },
        { name: 'FAQ' },
        { name: 'Promotions' },
        { name: 'Customer Looks' },
        { name: 'Customers' },
        { name: 'Admin' },
        { name: 'Shared' },
        { name: 'Uploads' },
        { name: 'Webhooks' },
        { name: 'Health' },
      ],
    },

    // FIX 2: Tells the swagger serialiser how to resolve $id back to a name
    // so $ref: 'SchemaId#' maps correctly in the rendered UI.
    refResolver: {
      buildLocalReference(json, _baseUri, _fragment, i) {
        const id = (json as Record<string, unknown>)['$id']
        return typeof id === 'string' ? id : `def-${i}`
      },
    },
  }

  await app.register(swagger, swaggerOptions)

  await app.register(swaggerUi, {
    routePrefix: '/docs',

    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },

    staticCSP: true,
    transformSpecificationClone: true,
  })
}

// fp() removes Fastify's plugin encapsulation boundary.
// Without it, @fastify/swagger runs in an isolated scope and cannot
// see routes registered in sibling plugins — so paths:{} stays empty.
export const swaggerPlugin = fp(swaggerPluginFn, {
  name: 'swagger-plugin',
  fastify: '4.x',
})