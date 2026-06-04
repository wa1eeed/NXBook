# Deployment

NXBook is **Docker-first** and portable: the same `docker-compose.yml` runs on
Hostinger/Coolify and on AWS/Alibaba with no code changes (CLAUDE.md §4).

---

## Services

`docker-compose.yml` defines four services:

| Service | Image / build | Notes |
|---------|---------------|-------|
| `app` | Dockerfile (runner) | Next.js standalone server |
| `workers` | Dockerfile (runner) | BullMQ workers + cron — **separate container** |
| `db` | postgres:16-alpine | PostgreSQL |
| `redis` | redis:7-alpine | cache + BullMQ store |

The Dockerfile is multi-stage (`deps → builder → runner`) and the app is built
with `output: "standalone"`.

---

## Environments

Three environments, each with its own `.env.<environment>` file and its own
database, Redis, and R2 bucket:

- **development** — hot reload, verbose logging.
- **staging** — mirrors production; CI deploys automatically.
- **production** — manual-approve deploy.

`NODE_ENV` selects the env file (`env_file: .env.${NODE_ENV}` in compose).
Sentry is initialized in all three with the correct `environment` tag. HSTS is
only emitted in production.

Set feature flags per environment (`ENABLE_AI_AGENTS`, `ENABLE_CUSTOM_AGENTS`,
…).

---

## First deploy (Coolify on a Hostinger VPS)

Minimum VPS: **8 GB RAM / 4 vCPU**.

1. Point Coolify at the repo; it reads `docker-compose.yml`.
2. Provide the production env (`.env.production`) with real credentials.
3. Coolify builds the image and starts `app`, `workers`, `db`, `redis`.
4. Run migrations on deploy: `npm run db:deploy` (uses `prisma migrate deploy`,
   never `db push`).
5. Seed once: `npm run db:seed`.
6. CI/CD: GitHub → build image → Coolify webhook (staging auto, production
   manual approve).

### TLS + custom domains
- The platform's apex/subdomains get TLS via Coolify/Caddy.
- Tenant **custom domains** are verified by DNS (TXT `_nxbook-verify.<domain>`
  + an A record to the server IP) and served with on-demand TLS; the tenant's
  domain is masked transparently (see [WEBHOOKS](WEBHOOKS.md) is unrelated; see
  [ARCHITECTURE](ARCHITECTURE.md) §2 for masking). Set `PLATFORM_SERVER_IP` so
  the dashboard shows the correct A-record target.

---

## Migrating to AWS / Alibaba

No code changes — only env:

- **Postgres** → RDS / ApsaraDB: change `DATABASE_URL`.
- **Redis** → ElastiCache / Alibaba Redis: change `REDIS_URL`.
- **Storage** → AWS S3: drop `R2_ACCOUNT_ID`, set `AWS_REGION`
  (R2 → Alibaba OSS is also S3-compatible).

Everything else (the Docker images, the app) is unchanged.

---

## Health & operations

- **Workers** must run as their own process/container; without them reminders,
  waitlist expiry, and agent crons won't fire.
- **Webhooks** (Moyasar/Twilio) must be reachable and signature-verified — see
  [WEBHOOKS](WEBHOOKS.md).
- **Backups:** snapshot Postgres regularly; Redis is a cache/queue (BullMQ uses
  AOF in the dev compose).
- **Monitoring:** Sentry captures app + worker errors with the environment tag.
- **`/api/health`** reports DB connectivity, table counts, the list of applied
  migrations (name + state), and key schema columns — hit it after every deploy
  to confirm migrations landed.

## Migrations on deploy (IMPORTANT — known issue)

`start.sh` runs `prisma migrate deploy` before `node server.js`, with a
self-healing retry (it marks any `failed` migration rolled-back and retries).
All migration SQL is written idempotently (`IF NOT EXISTS`, FK existence
guards) so a replay is a no-op.

**Observed 2026-06-04:** on at least one Coolify deploy the app code shipped but
`migrate deploy` did **not** apply the three new migrations, leaving the prod DB
missing columns/tables and 500-ing `/[slug]`, the dashboard, and onboarding.
Two recovery paths exist:

1. **`POST /api/apply-migration`** with header
   `x-migration-secret: <MIGRATION_SECRET>` — applies all pending migrations
   idempotently and records them in `_prisma_migrations`. (One-time helper;
   delete the route once the deploy pipeline is trusted.)
2. **Direct psql** (Coolify → Postgres container terminal). Note the prod
   credentials: **user `NXBook`, database `postgres`** (not `postgres`/`nxbook`).
   Connect with `psql -U NXBook -d postgres`, run the migration SQL, then
   insert rows into `_prisma_migrations` (no `ON CONFLICT` — `migration_name`
   has no unique constraint; use `WHERE NOT EXISTS`).

After recovery, verify with `/api/health` that every migration shows
`"state": "applied"`.

> **Open item:** the root cause of `migrate deploy` not running on auto-deploy
> is still under investigation — capture the full Coolify deployment log
> (build + start phases) on the next deploy to diagnose.
