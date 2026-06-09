# ─── Stage 1: Dependencies ─────────────────────────────────────────────────────
# Using node:20-slim (Debian) because Prisma's query engine
# requires libssl which is reliably present on Debian slim.
FROM node:20-slim AS deps
WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y openssl --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

# Install deps, then generate the Prisma client for the target platform.
# The binaryTargets in schema.prisma covers debian-openssl-1.1.x and
# debian-openssl-3.0.x so the right engine is always embedded.
RUN npm ci --frozen-lockfile && \
    npx prisma generate

# ─── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y openssl --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

RUN npm run build

# ─── Stage 3: Runner ───────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update -y && \
    apt-get install -y openssl --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs apiuser

# Copy compiled output, node_modules (includes generated Prisma client),
# prisma schema+migrations, and package manifest.
COPY --from=builder --chown=apiuser:nodejs /app/dist ./dist
COPY --from=builder --chown=apiuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=apiuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=apiuser:nodejs /app/package.json ./package.json

USER apiuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Run migrations before starting the server.
# DIRECT_URL is used by prisma migrate deploy (not the pooler).
# DATABASE_URL (pooler) is used by the running application.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
