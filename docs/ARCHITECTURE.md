# Architecture

NXBook is a multi-tenant booking SaaS built on Next.js 15 with a clean
separation between **HTTP/UI**, a **service layer** (`src/lib`, `src/agents`),
and **data** (Prisma/Postgres). Background work runs in a **separate workers
process**. This document explains how the pieces fit.

---

## 1. High-level shape

```
                    ┌──────────────────────────────────────┐
  Browser  ───────► │  Next.js app (App Router)            │
  (tenant /         │   • Server Components + Server Actions│
   customer /       │   • middleware: tenant + auth + masking│
   admin)           │   • /api: webhooks, upload, resolve   │
                    └───────────────┬──────────────────────┘
                                    │  (imports)
                    ┌───────────────▼──────────────────────┐
                    │  Service layer (src/lib, src/agents)  │
                    │   booking · waitlist · lifecycle ·    │
                    │   reports · ai · agents · notify ·    │
                    │   payment · storage · domains · audit │
                    └───────┬───────────────────┬──────────┘
                            │                   │
                    ┌───────▼──────┐    ┌───────▼─────────┐
                    │ PostgreSQL    │    │ Redis           │
                    │ (Prisma)      │    │ (cache + BullMQ)│
                    └───────────────┘    └───────┬─────────┘
                                                 │ (consumes)
                                    ┌────────────▼─────────────┐
                                    │ Workers process           │
                                    │  reminders · waitlist     │
                                    │  expiry · agents · cron   │
                                    └───────────────────────────┘
```

The **service layer is the heart**: every booking, waitlist, agent, and report
operation lives in `src/lib` / `src/agents` as plain functions that take a
`businessId`. UI (Server Actions), webhooks, the workers process, and a future
public API all call the *same* functions. This is what makes the public API a
thin wrapper rather than a rewrite.

---

## 2. Multi-tenancy

**Model:** shared database, shared schema, **row-level isolation by
`businessId`** (CLAUDE.md §5).

- Every tenant-owned table has an indexed `businessId`.
- The `businessId` is resolved from the authenticated session via
  `requireBusiness()` (`src/lib/tenant.ts`) — **never** read from a request body
  or param the client controls.
- Every dashboard Server Action funnels through `requireBusiness()` and scopes
  its queries by the returned `businessId`. Public (unauthenticated) actions
  resolve the business from the **slug/domain**, then scope by the resolved id.
- `canManage(role)` gates write actions (OWNER/MANAGER/SUPER_ADMIN).

### Tenant resolution (routing)
`src/middleware.ts` resolves the tenant for each request:
1. **Subdomain** `{slug}.platform.com` → rewrite to `/{slug}`.
2. **Custom domain** (foreign host) → look up the slug via
   `/api/resolve-domain` (Node runtime, since edge middleware can't use Prisma)
   → transparent rewrite to `/{slug}` (**domain masking** — the client's domain
   stays in the URL bar).
3. **Path-based** `/{slug}` works directly as a fallback.

---

## 3. Data model (Prisma)

The core entities:

- **Identity & tenancy:** `User`, `Session`, `Business`, `BusinessMember`.
- **Billing:** `Plan`, `Subscription`, `Invoice`, `CreditAccount`, `CreditTx`,
  `BusinessAIConfig`, `Transaction`, `PaymentGateway`.
- **Catalog:** `Service`, `ServiceAvailability`, `BusinessHoliday`, `Staff`,
  `StaffService`, `StaffLeave`.
- **Booking:** `Customer`, `Booking`, `Waitlist`.
- **AI:** `Agent`, `AgentLog`.
- **Ops:** `NotificationTemplate`, `NotificationLog`, `InAppNotification`,
  `Report`, `AuditLog`, `CustomDomain`, `PlatformConfig`,
  `PlatformAnnouncement`.

Notable columns added during the 2026-06 expansion:
- `Service.paymentMode` (`ON_ARRIVAL` | `ONLINE`) — per-service payment gate.
- `ServiceAvailability` unique index `[serviceId, dayOfWeek, startTime]` —
  blocks duplicate availability windows.
- `Subscription.gracePeriodHours` — trial grace window (default 48).
- `Business.socialLinks` / `locationUrl` / `meetingConfig` (JSON) — public-page
  config consumed by `/[slug]` and the booking-confirmation page.
- `InAppNotification` — tenant-facing dashboard notification feed (distinct
  from `NotificationLog`, which tracks outbound SMS/WhatsApp/email).

Conventions: `cuid()` ids; enums for fixed state sets; composite uniqueness
that models reality (`[businessId, phone]` for customers, `[businessId, type]`
for agents, `[businessId, type, period]` for cached reports); soft-delete via
status flags where history matters.

### Subscription enforcement

`src/lib/subscription-guard.ts#checkSubscriptionAccess(businessId)` is called
in the dashboard layout. It returns one of OK / TRIALING / GRACE_PERIOD /
EXPIRED / SUSPENDED / NO_SUBSCRIPTION. The layout hard-redirects EXPIRED and
SUSPENDED to `/pricing`; TRIALING(≤3d) and GRACE_PERIOD render a banner. The
guard is **fail-open**: any query error resolves to a non-blocking state so an
infrastructure issue (e.g. a missing column during a deploy window) can never
lock every tenant out of the dashboard.

### In-app notifications

`src/lib/notifications-center.ts#createNotification()` (never throws) is called
from `booking-lifecycle.ts` on new/cancel/no-show. The dashboard header bell
polls `GET /api/notifications` every 30s; `POST /api/notifications/mark-read`
clears the unread count. Both API routes resolve the tenant from the session.

---

## 4. Booking & waitlist engine

- **Slots** (`src/lib/booking.ts`) are generated from a service's weekly
  `ServiceAvailability`, sized by `durationMin`, with the cursor advancing by
  `durationMin + bufferMin` (prep/cleanup). Each slot tracks
  `capacity / booked / remaining`; group sessions use `maxCapacity > 1`.
- **Creating a booking** is transactional: it re-checks capacity inside the
  transaction to prevent overbooking and upserts the customer by
  `[businessId, phone]`.
- **Lifecycle** (`src/lib/booking-lifecycle.ts`):
  `PENDING → CONFIRMED → ATTENDED / NO_SHOW / CANCELLED`. On cancel/no-show the
  slot is freed and offered to the waitlist; no-shows bump `noShowScore`.
- **Waitlist** (`src/lib/waitlist.ts`): join → `offerNextInLine` (status
  `OFFERED` + 30-min expiry + notify) → `confirmOffer` (becomes a booking) /
  `expireOffer` (advance). The flagship metric **"revenue saved"** =
  `waitlistConfirmed × avgPrice`.

---

## 5. AI agents (plugin architecture)

Every agent extends `AgentPlugin` (`src/agents/base.ts`) with a uniform
interface (`type`, names, `triggers`, `minPlan`, `defaultConfig`, `execute`).
Adding an agent = one class + one registry entry; **no core changes**
(CLAUDE.md §10).

- **Registry:** `src/agents/registry.ts` (`AGENT_REGISTRY` + `agentCatalog()`).
- **Runner:** `src/agents/runner.ts` loads the tenant's active `Agent` row,
  credit-gates PLATFORM-billed tenants, executes, writes an `AgentLog`, rolls up
  stats, and reports failures to Sentry — never throwing.
- **AI guard:** `src/lib/ai-guard.ts` `safeGenerate()` calls the metered AI
  service when a real key exists, otherwise returns a template fallback. So
  agents run end-to-end even before keys are pasted (logged `usedAI=false`).
- **Triggers** (CLAUDE.md §10): **event** (slot freed → Waitlist agent),
  **delayed** (after attendance → Follow-up), **cron** (weekly Recovery +
  Analytics). Triggers enqueue to the agent queue; the workers process runs them.

The interface is intentionally **future-ready** for Level 2/3 custom agents:
`allowedTools` + a multi-step loop can be layered on without redesigning the
contract (CLAUDE.md §10.5).

---

## 6. Background jobs

`src/lib/queue.ts` defines BullMQ queues (`notification`, `reminder`,
`waitlist`, `agent`). BullMQ bundles its own ioredis, so we pass a connection
**options object** (`bullConnection()`) rather than the shared client to avoid a
dual-version type clash.

The **workers process** (`src/workers/index.ts`, run via `npm run workers`) is a
standalone Node process (its own container in production). It hosts:
- **reminder** worker — 24h/1h booking reminders (delayed jobs),
- **waitlist** worker — expire stale offers and advance the queue,
- **notification** worker — generic queued sends,
- **agent** worker — execute any enqueued agent run,
- **cron** — per-minute expired-offer sweep + weekly Recovery/Analytics.

Producers degrade gracefully if Redis is unavailable.

---

## 7. AI billing & credits

Two billing modes per tenant (`BusinessAIConfig.keyType`):
- **OWN_KEY** — tenant brings their own Anthropic/OpenAI key (encrypted at
  rest). Zero platform cost; no credit deduction.
- **PLATFORM** — platform keys, metered with a margin, deducted from a prepaid
  `CreditAccount`. Every call records tokens + SAR cost in `CreditTx` + `AgentLog`.

---

## 8. Internationalization

English primary, Arabic secondary (CLAUDE.md §2). Locale is **context-driven,
not URL-driven**: resolved from a `NEXT_LOCALE` cookie (falling back to the
default), so URLs stay clean and don't collide with `[slug]`/subdomain routing.
The root layout sets `<html lang dir>`; layout direction switches automatically
(`rtl` for Arabic). All user-facing strings live in `messages/en.json` +
`messages/ar.json`, kept at strict key parity. Business content uses paired
fields (`nameEn`/`nameAr`).

---

## 9. Security

See CLAUDE.md §7. Highlights: Zod validation on every action; AuthZ + tenant
ownership on every protected path; Redis rate limiting; audit logging of
sensitive actions; signed webhooks (Moyasar/Twilio); CSP/HSTS headers;
encrypted tenant AI keys; Prisma-parameterized queries (no raw SQL).

---

## 10. Portability

Docker-first: the same `docker-compose.yml` runs on Hostinger/Coolify and
AWS/Alibaba. Connections are env-driven (`DATABASE_URL`, `REDIS_URL`); storage
uses `@aws-sdk/client-s3` against Cloudflare R2 and moves to AWS S3 / Alibaba
OSS by changing a few env vars. No vendor-locked APIs. See
[DEPLOYMENT](DEPLOYMENT.md).
