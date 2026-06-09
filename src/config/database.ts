import { PrismaClient } from '@prisma/client'
import { env } from './env'

// ---------------------------------------------------------------------------
// Neon PostgreSQL + Prisma connection strategy
// ---------------------------------------------------------------------------
// Neon provides two connection endpoints:
//
//   DATABASE_URL  (pooler)   → PgBouncer endpoint, hostname contains "-pooler"
//                              Used at runtime for all application queries.
//                              Keeps connection counts low — critical for
//                              serverless / containers.
//
//   DIRECT_URL    (direct)   → Non-pooled endpoint, no "-pooler" in hostname.
//                              Only used by `prisma migrate deploy` /
//                              `prisma db push`. Never used by the app itself.
//
// The `directUrl` in schema.prisma routes migration commands to DIRECT_URL
// automatically so PgBouncer never interferes with DDL transactions.
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    // datasources.db.url is read from schema.prisma's env("DATABASE_URL").
    // We set it explicitly here so that any runtime override is respected.
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  })

// Reuse the singleton in development to survive hot-reloads without
// exhausting the connection pool.
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect()
  } catch (err) {
    console.error('❌ Failed to connect to database:', err)
    throw err
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}
