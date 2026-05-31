# ============================================================
# Dockerfile — Multi-stage build
# Stage 1 (deps):    install prod + dev deps, run prisma generate
# Stage 2 (builder): copy source, next build
# Stage 3 (runner):  minimal image, standalone output
#
# Workers run as a SEPARATE container via Dockerfile.workers.
# ============================================================

# ── Stage 1: install dependencies ──────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy prisma schema BEFORE npm ci so the postinstall
# (prisma generate) can find schema.prisma.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install ALL deps (including devDeps for build).
# We override NODE_ENV here so npm installs devDependencies
# even if Coolify passes NODE_ENV=production at build time.
RUN NODE_ENV=development npm ci --frozen-lockfile

# ── Stage 2: build Next.js app ─────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Re-generate Prisma client for this platform (alpine).
RUN npx prisma generate

RUN npm run build

# ── Stage 3: minimal production image ──────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Unprivileged user for security.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone output (includes only what's needed).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

# Public assets (may be empty — ok).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma schema + compiled client (needed at runtime for DB queries).
COPY --from=builder --chown=nextjs:nodejs /app/prisma              ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
