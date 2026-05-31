# Development

How to set up, run, and work on NXBook locally.

---

## Prerequisites

- **Node 20+** (the app targets Node 20; AWS SDK warns on <22 but works).
- **Docker** (for Postgres + Redis).
- **npm**.

---

## Setup

```bash
npm install                      # installs deps; postinstall runs prisma generate
ln -sf .env.development .env     # Prisma CLI + tsx --env-file read this
docker compose up -d db redis    # Postgres + Redis
npm run db:migrate               # apply migrations
npm run db:seed                  # plans + platform config + super-admin
```

Run the app and workers in two terminals:

```bash
npm run dev        # http://localhost:3000
npm run workers    # BullMQ workers + cron (needs Redis)
```

> **Local ports:** Postgres is mapped to host **5433** and Redis to **6380**
> (defaults 5432/6379 are assumed taken). `.env.development` already points at
> these. To use defaults, edit `docker-compose.yml` port mappings + the
> `DATABASE_URL`/`REDIS_URL` in `.env.development`.

Connect to the DB directly:
```bash
PGPASSWORD=devpassword psql -h localhost -p 5433 -U platform -d nxbook_dev
```

Seeded super-admin: `admin@nxbook.app` / `Admin@123456`.

---

## Environment

`.env.development` ships with safe local defaults. Third-party credentials are
marked `TODO_PASTE_*`; until pasted, the related feature degrades gracefully
(notifications log `skipped`, AI uses template fallbacks, payments return a
clear "not configured" error, uploads are disabled). See
[API_KEYS_TODO.md](API_KEYS_TODO.md).

---

## Project structure

```
src/
  app/
    (auth)/        login · register · onboarding
    (marketing)/   pricing
    dashboard/     home · bookings · services · staff · agents · reports · settings
    [slug]/        public tenant booking portal (+ custom-domain masking)
    waitlist/[id]/confirm   public waitlist-offer confirmation
    api/           auth · upload · resolve-domain · webhooks (moyasar, twilio)
  lib/             service layer — see below
  agents/          AgentPlugin base + 4 agents + registry + runner + triggers
  components/      ui (shadcn primitives) + dashboard
  workers/         BullMQ workers + cron (separate process)
  i18n/            config · request · actions (cookie-driven locale)
  middleware.ts    tenant resolution + route protection + domain masking
messages/          en.json (primary) · ar.json (secondary) — key parity required
prisma/            schema.prisma · migrations · seed.ts
docs/              this documentation
```

### The service layer (`src/lib`)
| File | Responsibility |
|------|----------------|
| `tenant.ts` | `requireBusiness()` / `canManage()` — tenant scoping |
| `booking.ts` | slot generation + capacity + `createBooking` |
| `booking-lifecycle.ts` | confirm/attend/cancel/no-show + reminders |
| `waitlist.ts` | join / offer / confirm / expire |
| `reports.ts` | tenant-scoped metrics + revenue-saved |
| `ai.ts` / `ai-guard.ts` | metered AI calls / safe fallback |
| `notify.ts` / `notification.ts` | dispatch guard / Twilio+Resend senders |
| `queue.ts` | BullMQ queue definitions |
| `payment.ts` | Moyasar subscriptions + credit top-up + webhook |
| `storage.ts` | Cloudflare R2 (S3-compatible) uploads |
| `domains.ts` | custom-domain add/verify/masking |
| `audit.ts` | sensitive-action audit log |
| `ratelimit.ts` | Redis rate limiting |

---

## Conventions

- **Language:** all code, comments, and identifiers in **English**. All
  user-facing text goes through next-intl (`messages/*.json`) — never hardcode
  strings. Keep `en.json` and `ar.json` at **strict key parity**.
- **Tenant scoping:** every data access is scoped by `businessId` from the
  session (dashboard) or the resolved slug/domain (public). Never trust a
  client-supplied `businessId`.
- **Validation:** validate every Server Action / route input with **Zod** before
  any logic.
- **CSS:** use **logical** properties (`*-inline-start`, `border-e`,
  `rtl:` utilities) so layouts mirror correctly in Arabic.
- **shadcn/ui:** primitives are hand-built under `src/components/ui` against the
  `cn()` helper + `components.json` (base color `neutral`). The shadcn CLI's
  `init -b neutral` flag is broken in the current version — set the base in
  `components.json`, don't pass the flag.
- **next.config.ts plugin order:** `withNextIntl(withSentryConfig(nextConfig))`
  — next-intl must be **outermost** or its request-config alias is lost at
  runtime ("Couldn't find next-intl config file").

---

## Database changes

```bash
# edit prisma/schema.prisma, then:
npm run db:migrate            # creates + applies a dev migration
npm run db:generate           # regenerate the client (also runs on install)
npm run db:studio             # browse data
```

Never use `db push` in staging/production — always migrations.

---

## Verifying a change

```bash
npx tsc --noEmit              # type check
npm run build                 # production build (catches RSC/route errors)
```

For end-to-end checks of the service layer, write a throwaway script and run it
with the workers' env file:

```bash
npx tsx --env-file=.env.development ./_scratch.ts
```

Always scope test data to a throwaway `Business` (e.g. slug `*-test`) and delete
it (cascade) at the end; keep the DB at seed-only state.

i18n parity check:
```bash
node -e "function k(o,p=''){let r=[];for(const x in o){const kp=p?p+'.'+x:x;r.push(kp);if(o[x]&&typeof o[x]==='object'&&!Array.isArray(o[x]))r=r.concat(k(o[x],kp))}return r.sort()}const en=require('./messages/en.json'),ar=require('./messages/ar.json');console.log(JSON.stringify(k(en))===JSON.stringify(k(ar))?'MATCH':'MISMATCH')"
```
