# ============================================================
# Dockerfile — Multi-stage build
# Stage 1 (deps):    install all deps (dev + prod), prisma generate
# Stage 2 (builder): copy source, next build
# Stage 3 (runner):  minimal image, standalone output + prisma CLI
# ============================================================

# ── Stage 1: install dependencies ───────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy prisma schema BEFORE npm ci — postinstall runs prisma generate
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Force NODE_ENV=development so devDependencies are always installed
# (needed for TypeScript, Next.js build tools). Coolify may inject
# NODE_ENV=production at build time which would skip devDeps.
RUN NODE_ENV=development npm ci --frozen-lockfile

# ── Stage 2: build Next.js ──────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# Build-time stubs — real values come from runtime env
ENV DATABASE_URL="postgresql://stub:stub@stub:5432/stub"
ENV NEXTAUTH_SECRET="build-stub-secret"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV JWT_ENCRYPTION_KEY="build-stub-jwt-key-32chars!!!!"
ENV ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Re-generate Prisma client compiled for linux/musl (alpine)
RUN npx prisma generate

RUN npm run build

# ── Stage 3: minimal runner ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Unprivileged user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# Prisma: compiled client + schema (for queries + migrations)
COPY --from=builder --chown=nextjs:nodejs /app/prisma              ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Prisma CLI (for migrate deploy at startup)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma          ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma         ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma     ./node_modules/.bin/prisma

# Startup script
COPY --chown=nextjs:nodejs start.sh ./
RUN chmod +x start.sh

USER nextjs
EXPOSE 3000
CMD ["sh", "start.sh"]
