# Gold Coast Hair API

Production-grade REST API for Gold Coast Hair e-commerce platform. Built with Fastify, TypeScript, Prisma, PostgreSQL, and Redis. Deployment-ready for Railway.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Fastify 4 |
| Language | TypeScript 5 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache / Rate Limit | Redis 7 |
| Auth | JWT (access + refresh tokens) |
| Validation | Zod |
| Image Storage | Cloudinary |
| Payments | Paystack |
| Containerisation | Docker |
| Deployment | Railway |

---

## Architecture

```
src/
├── config/           # env, database, redis singletons
├── modules/          # feature modules (auth, products, orders, ...)
│   ├── auth/         # schema · service · controller · routes
│   ├── products/
│   ├── orders/
│   ├── reviews/
│   └── uploads/
├── shared/
│   ├── errors/       # typed AppError hierarchy
│   ├── middleware/   # auth guards, error handler
│   ├── hooks/        # health checks, webhooks
│   ├── types/        # response shapes, pagination
│   └── utils/        # jwt, generators, cloudinary
└── server.ts         # entry point + graceful shutdown
```

Each module is fully self-contained: schema → service → controller → routes. No circular dependencies.

---

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose

### 1. Clone and install

```bash
git clone <repo>
cd goldcoast-api
npm install
```

### 2. Environment

```bash
cp .env.example .env
# Fill in your values (see Environment Variables section)
```

### 3. Start infrastructure

```bash
docker compose up postgres redis -d
```

### 4. Run migrations and seed

```bash
npm run db:migrate
npm run db:seed
```

### 5. Start development server

```bash
npm run dev
```

API is live at `http://localhost:3000/api/v1`

Health check: `http://localhost:3000/health`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string (use `rediss://` for TLS) |
| `JWT_ACCESS_SECRET` | ✅ | Min 32 chars. Generate: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | ✅ | Min 32 chars. Different from access secret |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary account cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `PAYSTACK_SECRET_KEY` | ✅ | Paystack secret key |
| `PAYSTACK_WEBHOOK_SECRET` | ✅ | Paystack webhook signing secret |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins |
| `PORT` | ❌ | Default 3000. Railway injects this automatically |
| `BCRYPT_ROUNDS` | ❌ | Default 12. Lower only in test environments |
| `RATE_LIMIT_MAX` | ❌ | Default 100 requests per window |
| `LOG_LEVEL` | ❌ | Default `info` |

---

## API Reference

Base URL: `/api/v1`

### Auth
| Method | Endpoint | Auth |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/refresh` | Public |
| POST | `/auth/logout` | Public |
| POST | `/auth/admin/login` | Public |

### Products
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/products` | Public |
| GET | `/products/featured` | Public |
| GET | `/products/sale` | Public |
| GET | `/products/categories` | Public |
| GET | `/products/:id` | Public |
| POST | `/products` | Admin |
| PUT | `/products/:id` | Admin |
| DELETE | `/products/:id` | Admin |
| POST | `/products/:id/images` | Admin |

### Bundles
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/bundles` | Public |
| GET | `/bundles/:id` | Public |
| POST | `/bundles` | Admin |
| PUT | `/bundles/:id` | Admin |
| DELETE | `/bundles/:id` | Admin |

### Cart
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/cart/:sessionId` | Public |
| POST | `/cart/:sessionId/items` | Public |
| PUT | `/cart/:sessionId/items/:itemId` | Public |
| DELETE | `/cart/:sessionId/items/:itemId` | Public |
| DELETE | `/cart/:sessionId` | Public |

### Orders
| Method | Endpoint | Auth |
|---|---|---|
| POST | `/orders` | Public |
| GET | `/orders/track` | Public |
| DELETE | `/orders/:id` | Customer |
| GET | `/orders` | Admin |
| GET | `/orders/:id` | Admin |
| PUT | `/orders/:id/status` | Admin |

### Reviews
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/reviews` | Public |
| GET | `/reviews/summary` | Public |
| POST | `/reviews` | Optional Auth |
| DELETE | `/reviews/:id` | Customer / Admin |

### Enquiries
| Method | Endpoint | Auth |
|---|---|---|
| POST | `/enquiries` | Public |
| GET | `/enquiries` | Admin |
| GET | `/enquiries/:id` | Admin |
| PUT | `/enquiries/:id/status` | Admin |

### Promotions
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/promotions` | Public |
| GET | `/promotions/active` | Public |
| POST | `/promotions` | Admin |
| PUT | `/promotions/:id` | Admin |
| DELETE | `/promotions/:id` | Admin |

### FAQ
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/faq` | Public |
| POST | `/faq` | Admin |
| PUT | `/faq/:id` | Admin |
| DELETE | `/faq/:id` | Admin |

### Customer Looks
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/customer-looks` | Public |
| POST | `/customer-looks` | Optional Auth |
| POST | `/customer-looks/upload` | Optional Auth |
| PUT | `/customer-looks/:id/approve` | Admin |
| DELETE | `/customer-looks/:id` | Admin |

### Customers
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/customers/:id` | Customer (own) |
| PUT | `/customers/:id` | Customer (own) |
| GET | `/customers/:id/orders` | Customer (own) |

### Admin
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/admin/dashboard` | Admin |
| GET | `/admin/users` | Superadmin |
| POST | `/admin/users` | Superadmin |
| GET | `/admin/audit-logs` | Superadmin |

### Health
| Method | Endpoint | Auth |
|---|---|---|
| GET | `/health` | Public |
| GET | `/health/detailed` | Public |
| GET | `/health/ready` | Public |

### Webhooks
| Method | Endpoint | Auth |
|---|---|---|
| POST | `/webhooks/paystack` | Paystack Signature |

---

## Response Format

All responses follow this shape:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Product with id '99' not found",
    "details": {}
  }
}
```

---

## Deployment: Railway

### Step 1 — Create Railway project

```bash
railway login
railway init
```

### Step 2 — Add services in Railway dashboard

- Add **PostgreSQL** plugin → copy `DATABASE_URL`
- Add **Redis** plugin → copy `REDIS_URL` (use `rediss://` URL for TLS)

### Step 3 — Set environment variables

In Railway dashboard → Variables, add all variables from `.env.example`.

Generate secrets:
```bash
openssl rand -hex 32  # JWT_ACCESS_SECRET
openssl rand -hex 32  # JWT_REFRESH_SECRET
```

### Step 4 — Deploy

```bash
railway up
```

Railway will detect the `Dockerfile`, build the image, and deploy. The `railway.json` configures the health check path and restart policy automatically.

### Step 5 — Run migrations on Railway

```bash
railway run npm run db:migrate
railway run npm run db:seed
```

---

## Running Tests

```bash
# Unit tests only (no DB needed)
npm test

# With coverage
npm run test:coverage

# Integration tests (requires running DB + Redis)
DATABASE_URL=... REDIS_URL=... npm run test:e2e
```

---

## Scaling Recommendations

- **Horizontal scaling**: The API is fully stateless — no in-memory state. Scale Railway instances freely.
- **Redis caching**: Products, FAQs, and promotions are cached. TTL is 5 minutes by default.
- **DB pooling**: Prisma handles connection pooling. For very high traffic, add PgBouncer in front of Postgres.
- **Rate limiting**: Redis-backed, works correctly across multiple instances.
- **Image uploads**: Cloudinary handles all media — no local storage assumptions.
- **Background jobs**: Payment webhook processing is synchronous now. For high volume, move to a Redis queue (Bull/BullMQ) as a separate Railway worker service.

---

## Default Admin Credentials (after seed)

```
Email:    admin@goldcoasthair.com
Password: Admin123!
```

**Change these immediately after first login in production.**
