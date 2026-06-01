# ============================================================
# Dockerfile — Multi-stage build
# Stage 1 (deps):    install all deps (dev+prod), prisma generate
# Stage 2 (builder): copy source, next build
# Stage 3 (runner):  minimal image, standalone + full prisma CLI
# ============================================================

# ── Stage 1: install dependencies ───────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Force NODE_ENV=development so devDependencies are installed
# even when Coolify injects NODE_ENV=production at build time.
RUN NODE_ENV=development npm ci --frozen-lockfile

# ── Stage 2: build Next.js ──────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://stub:stub@stub:5432/stub"
ENV NEXTAUTH_SECRET="build-stub-secret-min-32-chars!!"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV JWT_ENCRYPTION_KEY="build-stub-jwt-key-32chars!!!!"
ENV ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"
# Blank out Sentry auth token so the plugin never attempts network calls
# (source-map upload) during Docker build — upload failures would fail the
# whole build. Real value is available at runtime via Coolify env vars.
ENV SENTRY_AUTH_TOKEN=""
# Cap Node.js heap so the build doesn't OOM-kill the Docker daemon when other
# containers (db / redis / workers / the live app) are running on the VPS.
ENV NODE_OPTIONS="--max-old-space-size=3072"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Re-generate Prisma client for linux/musl (alpine target)
RUN npx prisma generate

RUN npm run build

# ── Stage 3: minimal runner ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Make local node_modules/.bin available so tools like `tsx` (used by
# `prisma db seed`) and `prisma` itself resolve without absolute paths.
ENV PATH="/app/node_modules/.bin:${PATH}"

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone server + static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# Prisma schema (needed by migrate deploy at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Prisma generated client (runtime DB queries)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Full Prisma CLI + engines including .wasm files
# (prisma_schema_build_bg.wasm lives inside node_modules/prisma)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma  ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Transitive deps of @prisma/config that the standalone build doesn't bundle.
# `effect` is required by @prisma/config at runtime (migrate deploy / db seed).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/effect ./node_modules/effect

# tsx is needed by `prisma db seed` to execute prisma/seed.ts at runtime.
# Also copy its small runtime deps (esbuild + get-tsconfig).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tsx          ./node_modules/tsx
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/tsx     ./node_modules/.bin/tsx
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/esbuild      ./node_modules/esbuild
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/esbuild ./node_modules/.bin/esbuild
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@esbuild     ./node_modules/@esbuild
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/get-tsconfig ./node_modules/get-tsconfig

# Startup script
COPY --chown=nextjs:nodejs start.sh ./
RUN chmod +x start.sh

USER nextjs
EXPOSE 3000
CMD ["sh", "start.sh"]
