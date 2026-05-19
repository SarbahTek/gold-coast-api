import { FastifyInstance } from 'fastify'
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

const definitions: Record<string, any> = {
  RegisterBody: {
    type: 'object',
    additionalProperties: false,
    required: ['firstName', 'lastName', 'email', 'password'],
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: {
        type: 'string',
        format: 'email',
      },
      phone: { type: 'string' },
      password: {
        type: 'string',
        minLength: 8,
      },
    },
  },

  LoginBody: {
    type: 'object',
    additionalProperties: false,
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
      },
      password: {
        type: 'string',
      },
    },
  },

  RefreshBody: {
    type: 'object',
    additionalProperties: false,
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
      },
    },
  },

  TokenResponse: {
    type: 'object',
    properties: {
      accessToken: {
        type: 'string',
      },
      refreshToken: {
        type: 'string',
      },
    },
  },

  Product: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      price: { type: 'number' },
      stockQty: { type: 'integer' },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  CreateProductBody: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'category', 'price'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      price: { type: 'number' },
      stockQty: {
        type: 'integer',
        default: 0,
      },
    },
  },

  Order: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      orderNumber: { type: 'string' },
      status: { type: 'string' },
      totalAmount: { type: 'number' },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  PlaceOrderBody: {
    type: 'object',
    additionalProperties: false,
    required: ['shippingAddress', 'phone', 'items'],
    properties: {
      shippingAddress: {
        type: 'string',
      },
      phone: {
        type: 'string',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: {
              type: 'integer',
            },
            quantity: {
              type: 'integer',
              minimum: 1,
            },
          },
        },
      },
    },
  },
} as const

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
  
    body: definitions.RegisterBody,
  
    response: {
      201: ApiResponse,
      400: ErrorResponse,
    },
  },
  
  login: {
    tags: ['Auth'],
    summary: 'Login user',
  
    body: definitions.LoginBody,
  
    response: {
      200: ApiResponse,
      401: ErrorResponse,
    },
  },
  
  refresh: {
    tags: ['Auth'],
    summary: 'Refresh access token',
  
    body: definitions.RefreshBody,
  
    response: {
      200: ApiResponse,
      401: ErrorResponse,
    },
  },
  logout: {
    tags: ['Auth'],
    summary: 'Logout user',
  
    security: defaultProtected,
  
    response: {
      200: ApiResponse,
      401: ErrorResponse,
    },
  },
  
  adminLogin: {
    tags: ['Auth'],
    summary: 'Admin login',
  
    body: definitions.LoginBody,
  
    response: {
      200: ApiResponse,
      401: ErrorResponse,
    },
  },

  // PRODUCTS

  listProducts: {
    tags: ['Products'],
    summary: 'List products',
    querystring: PaginationQuery,
    response: {
      200: ApiResponse,
    },
  },

  getProduct: {
    tags: ['Products'],
    summary: 'Get product',
    params: IdParam,
    response: {
      200: ApiResponse,
      404: ErrorResponse,
    },
  },

  createProduct: {
    tags: ['Products'],
    summary: 'Create product',
  
    security: defaultProtected,
  
    body: definitions.CreateProductBody,
  
    response: {
      201: ApiResponse,
      400: ErrorResponse,
    },
  },
  
  updateProduct: {
    tags: ['Products'],
    summary: 'Update product',
  
    security: defaultProtected,
  
    params: IdParam,
  
    body: definitions.CreateProductBody,
  
    response: {
      200: ApiResponse,
      404: ErrorResponse,
    },
  },

  deleteProduct: {
    tags: ['Products'],
    summary: 'Delete product',
    security: defaultProtected,
    params: IdParam,
    response: {
      200: ApiResponse,
      404: ErrorResponse,
    },
  },

  getFeatured: {
    tags: ['Products'],
    summary: 'Get featured products',
    response: DefaultRouteResponse,
  },

  getSale: {
    tags: ['Products'],
    summary: 'Get sale products',
    response: DefaultRouteResponse,
  },

  getCategories: {
    tags: ['Products'],
    summary: 'Get product categories',
    response: DefaultRouteResponse,
  },

  // ORDERS

  placeOrder: {
    tags: ['Orders'],
    summary: 'Place order',
  
    body: definitions.PlaceOrderBody,
  
    response: {
      201: ApiResponse,
      400: ErrorResponse,
    },
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
    tags: ['Shared'],
    summary: 'Create enquiry',
    response: DefaultRouteResponse,
  },

  listEnquiries: {
    tags: ['Shared'],
    summary: 'List enquiries',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  getEnquiry: {
    tags: ['Shared'],
    summary: 'Get enquiry',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  updateEnquiryStatus: {
    tags: ['Shared'],
    summary: 'Update enquiry status',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  listFaq: {
    tags: ['Shared'],
    summary: 'List FAQ',
    response: DefaultRouteResponse,
  },

  createFaq: {
    tags: ['Shared'],
    summary: 'Create FAQ',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  updateFaq: {
    tags: ['Shared'],
    summary: 'Update FAQ',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  deleteFaq: {
    tags: ['Shared'],
    summary: 'Delete FAQ',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  listPromotions: {
    tags: ['Shared'],
    summary: 'List promotions',
    response: DefaultRouteResponse,
  },

  getActivePromotion: {
    tags: ['Shared'],
    summary: 'Get active promotion',
    response: DefaultRouteResponse,
  },

  createPromotion: {
    tags: ['Shared'],
    summary: 'Create promotion',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  updatePromotion: {
    tags: ['Shared'],
    summary: 'Update promotion',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  deactivatePromotion: {
    tags: ['Shared'],
    summary: 'Deactivate promotion',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  listCustomerLooks: {
    tags: ['Shared'],
    summary: 'List customer looks',
    response: DefaultRouteResponse,
  },

  submitLook: {
    tags: ['Shared'],
    summary: 'Submit customer look',
    response: DefaultRouteResponse,
  },

  approveLook: {
    tags: ['Shared'],
    summary: 'Approve customer look',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  deleteLook: {
    tags: ['Shared'],
    summary: 'Delete customer look',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  getCart: {
    tags: ['Shared'],
    summary: 'Get cart',
    response: DefaultRouteResponse,
  },

  addCartItem: {
    tags: ['Shared'],
    summary: 'Add cart item',
    response: DefaultRouteResponse,
  },

  updateCartItem: {
    tags: ['Shared'],
    summary: 'Update cart item',
    response: DefaultRouteResponse,
  },

  removeCartItem: {
    tags: ['Shared'],
    summary: 'Remove cart item',
    response: DefaultRouteResponse,
  },

  clearCart: {
    tags: ['Shared'],
    summary: 'Clear cart',
    response: DefaultRouteResponse,
  },

  listBundles: {
    tags: ['Shared'],
    summary: 'List bundles',
    response: DefaultRouteResponse,
  },

  getBundle: {
    tags: ['Shared'],
    summary: 'Get bundle',
    params: IdParam,
    response: DefaultRouteResponse,
  },

  createBundle: {
    tags: ['Shared'],
    summary: 'Create bundle',
    security: defaultProtected,
    response: DefaultRouteResponse,
  },

  updateBundle: {
    tags: ['Shared'],
    summary: 'Update bundle',
    security: defaultProtected,
    params: IdParam,
    response: DefaultRouteResponse,
  },

  deleteBundle: {
    tags: ['Shared'],
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

export async function swaggerPlugin(
  app: FastifyInstance
): Promise<void> {

  const swaggerOptions: FastifyDynamicSwaggerOptions = {
    openapi: {
      openapi: '3.0.3',
  
      info: {
        title: 'Gold Coast Hair API',
        version: '1.0.0',
        description: 'Production API documentation',
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
  
      tags: [
        { name: 'Auth' },
        { name: 'Products' },
        { name: 'Orders' },
        { name: 'Reviews' },
        { name: 'Admin' },
        { name: 'Customers' },
        { name: 'Shared' },
        { name: 'Uploads' },
        { name: 'Webhooks' },
        { name: 'Health' },
      ],
    },
  }
  
  await app.register(swagger, swaggerOptions)
  
  await app.register(swaggerUi, {
    routePrefix: '/docs',
  
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
    },
  
    staticCSP: true,
    transformSpecificationClone: true,
  })
}