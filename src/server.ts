import { buildApp } from './app'
import { env } from './config/env'
import { connectDatabase, disconnectDatabase } from './config/database'
import { connectRedis, disconnectRedis } from './config/redis'

async function main(): Promise<void> {
  // Validate environment on startup - fail fast
  console.info(`Starting ${env.APP_NAME} in ${env.NODE_ENV} mode...`)

  // Connect to dependencies
  await connectDatabase()
  console.info('✅ Database connected')

  await connectRedis()
  console.info('✅ Redis connected')

  const app = await buildApp()

  // Bind to 0.0.0.0 for Railway - CRITICAL
  await app.listen({ port: env.PORT, host: env.HOST })
  console.info(`🚀 Server listening on ${env.HOST}:${env.PORT}`)
  console.info(`📡 API available at http://${env.HOST}:${env.PORT}${env.API_PREFIX}`)

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────
  // Railway sends SIGTERM on redeploy/restart — handle it properly

  const shutdown = async (signal: string): Promise<void> => {
    console.info(`\n⚠️  Received ${signal}. Shutting down gracefully...`)

    try {
      // Stop accepting new connections
      await app.close()
      console.info('✅ HTTP server closed')

      // Close DB and Redis
      await disconnectDatabase()
      console.info('✅ Database disconnected')

      await disconnectRedis()
      console.info('✅ Redis disconnected')

      console.info('👋 Shutdown complete')
      process.exit(0)
    } catch (err) {
      console.error('❌ Error during shutdown:', err)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Catch unhandled rejections - Railway will restart the container
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason)
    shutdown('unhandledRejection')
  })

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err)
    shutdown('uncaughtException')
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
