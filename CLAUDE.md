# CLAUDE.md — NXBook

**Project name:** NXBook
**Tagline:** Booking SaaS that guarantees your customers actually show up.
**Package/repo name:** `nxbook`


> **READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.**
> This is the single source of truth for the project. When in doubt, follow this document.
> Model requirement: build using **Claude Opus 4.8** for high quality and speed.

---

## 1. PROJECT OVERVIEW

A multi-tenant **booking SaaS platform** for appointment-based businesses (clinics, salons, fitness studios, consulting, education, and any service that runs on bookings). The platform has **two layers**:

1. **Booking Engine** (core) — businesses subscribe, customize a dashboard, get a public landing page on a subdomain/custom domain, add services + availability + slot capacity, manage bookings, confirm attendance, and run smart waitlists.
2. **AI Agents Layer** (differentiator) — autonomous agents that work on behalf of the business: waitlist management, post-visit follow-up, customer win-back/recovery, and analytics with actionable recommendations. Extensible to optional agents (marketing, social media, support, review).

**Strategic positioning:** Competitors (e.g. Rekaz) answer "how do you take a booking?" — we answer the deeper question: "how do you guarantee the customer actually shows up?" The waitlist + no-show intelligence + AI agents are the core moat.

---

## 2. LANGUAGE & INTERNATIONALIZATION (CRITICAL — read carefully)

**English is the PRIMARY/DEFAULT language of the entire codebase.** Arabic is the SECONDARY language.

### Codebase rules
- ALL code, comments, variable names, function names, database fields, commit messages, and documentation are in **English**.
- ALL user-facing strings go through an i18n layer (`next-intl`). NEVER hardcode user-facing text in any language.
- Translation files: `messages/en.json` (primary, complete) and `messages/ar.json` (secondary, complete).
- Default locale = `en`. Supported locales = `["en", "ar"]`.

### Language selection rules (three independent contexts)
1. **Main SaaS landing/marketing site** — the SUPER ADMIN chooses the default language from the admin panel. Visitors can switch.
2. **Client (tenant) Dashboard** — the CLIENT chooses their default language: (a) during onboarding at registration, and (b) anytime from dashboard settings. Stored on the `Business` record as `defaultLocale`.
3. **Admin Dashboard** — the SUPER ADMIN chooses the default language for the admin panel.

### RTL/LTR
- Layout direction MUST switch automatically based on active locale: `dir="rtl"` for Arabic, `dir="ltr"` for English.
- Use logical CSS properties (`margin-inline-start`, `padding-inline-end`, `text-align: start`) NEVER physical (`margin-left`, `padding-right`).
- Tailwind: rely on logical utilities and the `dir` attribute, not `lp`/`rp` hardcoded sides.
- The public booking landing page for each tenant renders in THAT tenant's `defaultLocale`, with a visitor language toggle.

### Storage of bilingual content
- Business-authored content that needs both languages (service names, descriptions) uses paired fields: `nameEn` / `nameAr`, `descriptionEn` / `descriptionAr`. Primary (`*En`) is required, secondary (`*Ar`) is optional and falls back to primary.

---

## 3. TECH STACK (do not deviate without explicit instruction)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui components |
| i18n | next-intl |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache + Queue store | Redis 7 |
| Background jobs | BullMQ (workers as separate process) |
| Scheduled jobs | node-cron (inside workers process) |
| Auth | NextAuth v5 (JWT strategy, multi-role) |
| AI | Anthropic Claude (primary) + OpenAI (fallback) — multi-model |
| File storage | Cloudflare R2 (S3-compatible) |
| Email | Resend |
| SMS + WhatsApp | Twilio |
| Payments | Moyasar (SAR, mada, Apple Pay, Tabby/Tamara) |
| Error monitoring | Sentry (all 3 environments) |
| Validation | Zod (every API input) |
| Data fetching | TanStack Query (client) + Server Components |
| Hosting (initial) | Hostinger VPS via Coolify (Docker) |
| Hosting (future) | AWS or Alibaba Cloud SA — migration-ready |

---

## 4. INFRASTRUCTURE & DEPLOYMENT

### Initial deployment: Hostinger VPS + Coolify
- Everything runs as Docker containers orchestrated by Coolify reading `docker-compose.yml`.
- Services: `app` (Next.js), `workers` (BullMQ + cron, SEPARATE container), `db` (Postgres), `redis`.
- Minimum VPS: 8GB RAM / 4 vCPU.

### Migration-ready architecture (AWS / Alibaba Cloud later)
- **Docker-first**: the same `docker-compose.yml` runs on Hostinger and AWS/Alibaba with zero code changes.
- DB connection is env-driven (`DATABASE_URL`) — moving to managed Postgres (RDS / ApsaraDB) = change one env var.
- Redis connection is env-driven (`REDIS_URL`) — moving to ElastiCache / Alibaba Redis = change one env var.
- File storage uses `@aws-sdk/client-s3` against R2. Moving to AWS S3 = change 3 env vars (drop `R2_ACCOUNT_ID`, set `AWS_REGION`). R2 → Alibaba OSS also S3-compatible.
- NO vendor-locked services. NO Vercel-specific APIs. Everything portable.

### Three environments — dev / staging / production
- Each has its own `.env.<environment>` file and its own database + Redis + R2 bucket.
- `NODE_ENV` drives behavior. Feature flags per environment (e.g. `ENABLE_CUSTOM_AGENTS`).
- Sentry initialized in ALL three with the `environment` tag set correctly.
- Staging mirrors production exactly; dev allows hot reload + verbose logging.
- CI/CD: GitHub → build Docker image → deploy via Coolify webhook (staging auto, production manual approve).

---

## 5. MULTI-TENANCY ARCHITECTURE

**Model: shared database, shared schema, row-level tenant isolation by `businessId`.** (Best balance of cost, scalability, and maintainability for this stage; can shard later.)

### Hard rules
- EVERY tenant-owned table has a `businessId` column, indexed.
- EVERY query that reads/writes tenant data MUST be scoped by `businessId`. NO exceptions.
- Create a Prisma middleware / extension that auto-injects `businessId` from the auth session for all tenant models, so a forgotten filter cannot leak cross-tenant data. Treat missing `businessId` scope as a security bug.
- The `businessId` always comes from the authenticated session, NEVER from a request body/param the client controls.
- Super admin queries that intentionally cross tenants must be explicit and go through a separate, audited code path.

### Tenant resolution (routing)
- Subdomain: `{slug}.platform.com` → resolves to tenant by `slug`.
- Path-based (fallback): `platform.com/{slug}`.
- Custom domain (see section 6) → resolves to tenant by verified domain.
- Resolution happens in `middleware.ts`, sets tenant context for the request.

---

## 6. CUSTOM DOMAINS (client-owned domains)

Clients can connect their own domain to their booking landing page.

### Flow
1. Client enters their domain (e.g. `book.theirclinic.com`) in dashboard settings.
2. Platform generates a verification token and shows DNS instructions:
   - An **A record** pointing to the platform's server IP (or a CNAME to the platform host).
   - A **TXT record** for ownership verification (e.g. `_platform-verify.book.theirclinic.com = <token>`).
3. Client adds the records at their registrar.
4. Platform verifies: polls DNS until the TXT token matches AND the A/CNAME resolves correctly.
5. On success: mark domain `verified`, provision TLS automatically (Caddy/Coolify on-demand TLS or Let's Encrypt wildcard + per-domain cert), and route that domain to the tenant's landing page (**domain masking** — the client's domain stays in the URL bar; our platform serves the content transparently).
6. Store domain state machine: `PENDING → VERIFYING → VERIFIED → ACTIVE` (and `FAILED`).

### Implementation notes
- A `CustomDomain` model: `businessId`, `domain`, `verifyToken`, `status`, `verifiedAt`, `sslStatus`.
- Middleware resolves an incoming custom domain → tenant.
- Domain masking = transparent rewrite, the client domain never redirects to our domain.
- Background cron re-checks SSL renewal and DNS health.

---

## 7. SECURITY & SECURE APIs (non-negotiable)

- **Input validation**: every API route and Server Action validates input with Zod before any logic. Reject invalid early.
- **AuthZ on every endpoint**: verify session + role + tenant ownership on EVERY protected route. Never trust client-supplied `businessId`.
- **Secrets**: all secrets in env vars, never committed. Tenant-provided AI API keys are **encrypted at rest** (AES-256 via `JWT_ENCRYPTION_KEY`), never logged, never returned to the client in plaintext.
- **Rate limiting**: per-IP and per-tenant rate limits on public booking endpoints and auth endpoints (Redis-backed).
- **CSRF**: Server Actions + same-site cookies; verify origin on state-changing requests.
- **Webhooks**: verify signatures (Moyasar signature, Twilio signature) before processing. Reject unsigned/invalid.
- **SQL injection**: Prisma parameterizes by default — never use raw string-interpolated SQL.
- **XSS**: never `dangerouslySetInnerHTML` with user content; sanitize any rich text.
- **Headers**: set security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) in `next.config` / middleware.
- **PII**: customer phone/email is tenant data — scoped, access-controlled, and never exposed cross-tenant.
- **Audit log**: log sensitive actions (role changes, domain changes, billing changes, data exports) with actor + timestamp.
- **Sessions**: short-lived JWT + refresh; invalidate on password reset; track session metadata (IP, UA).
- **Least privilege**: roles = SUPER_ADMIN, OWNER, MANAGER, STAFF — enforce capability checks per action.
- **Dependency hygiene**: pin versions; no untrusted packages.

---

## 8. DATABASE SCHEMA PRINCIPLES (scale + maintain + evolve)

- Use `cuid()` IDs (collision-resistant, sortable-ish, safe in URLs).
- Index every foreign key and every column used in WHERE/ORDER BY (especially `businessId`, `date`, `status`, `phone`, score columns).
- Use enums for fixed state sets (BookingStatus, WaitlistStatus, etc.) — never free-text status.
- Soft-delete where history matters (bookings, customers) via status flags, not hard deletes.
- Use `@db.Text` for long content (prompts, responses, message bodies).
- Money stored as Float in SAR for now; consider integer halalas if precision issues arise.
- Use migrations (`prisma migrate`) for all schema changes — never `db push` in staging/production.
- Composite uniqueness where it models reality (`[businessId, phone]` for customers, `[businessId, type]` for agents).
- Cache generated reports in a `Report` table keyed by `[businessId, type, period]` to avoid recomputation.
- Keep AI usage auditable: every AI call recorded in `CreditTx` and `AgentLog` with tokens + cost.

### Core entities (already designed — see schema.prisma)
PlatformConfig, User, Session, Business, BusinessMember, Plan, Subscription, Invoice, BusinessAIConfig, CreditAccount, CreditTx, Service, ServiceAvailability, BusinessHoliday, Staff, StaffService, StaffLeave, Customer, Booking, Waitlist, Agent, AgentLog, NotificationTemplate, NotificationLog, Report. **Add: CustomDomain.** **Add `defaultLocale` to Business.**

---

## 9. AI MODEL STRATEGY

- **Multi-model**: Anthropic Claude (primary) + OpenAI (fallback). Tiered by complexity: fast model (Haiku/gpt-4o-mini) for routine messages, smart model (Sonnet/gpt-4o) for analytics/reports.
- **Two billing modes per tenant** (`BusinessAIConfig.keyType`):
  1. `OWN_KEY` — tenant brings their own Anthropic/OpenAI API key (encrypted at rest). Zero cost to platform; no credit deduction.
  2. `PLATFORM` — tenant uses platform's keys; we meter token usage, apply a margin (`platformMargin`, default 1.5×), and deduct from the tenant's prepaid **credit balance** (`CreditAccount`). Tenants top up credits via Moyasar; the providers bill US, we bill the tenant.
- Every AI call: check balance (if PLATFORM) → call provider → record tokens + computed SAR cost → deduct credits → log in `AgentLog` + `CreditTx`.
- Per-agent model override allowed (`agentModelMap`).
- On provider failure: capture in Sentry, attempt fallback provider.

---

## 10. AI AGENTS (plugin architecture)

Every agent extends an abstract `AgentPlugin` base class with a uniform interface: `type`, `nameEn`, `nameAr`, `triggers[]`, `defaultConfig`, `execute(context)`. Adding a new agent = one new class registered in `AGENT_REGISTRY` — NO changes to core.

### Trigger mechanisms
- **Event-based** (BullMQ): fired by domain events (booking cancelled, no-show recorded, slot opened) — near-instant.
- **Delayed jobs** (BullMQ): scheduled at booking time (reminder 24h/1h, follow-up 2h after attendance).
- **Cron** (node-cron): recurring (weekly recovery scan, weekly/monthly analytics reports).

### Core agents (Growth+ plans)
1. **Waitlist Agent** — on cancel/no-show, offers the slot to the next person in line (WhatsApp), 30-min confirm window, auto-advances on expiry.
2. **Follow-up Agent** — 2h after attendance sends a review request; analyzes sentiment; alerts owner on negative; suggests next appointment for recurring services.
3. **Recovery Agent** — weekly scan for customers absent 30/60 days; sends context-aware win-back messages; prioritizes VIPs.
4. **Analytics Agent** — weekly/monthly reports with ACTIONABLE recommendations (peak hours, no-show patterns, waitlist conversion / "revenue saved").

### Optional agents (paid add-ons)
Marketing Agent, Social Media Agent, Support Agent, Review Agent.

### The flagship metric
**Waitlist conversion / "revenue saved"** — no competitor surfaces this. Show tenants exactly how much revenue the waitlist + agents recovered.

---

## 10.5 CUSTOM / AUTONOMOUS AGENTS (future-ready architecture)

The `AgentPlugin` system MUST be designed so it can later support **client-created custom agents** WITHOUT breaking the core. Do not build this in the MVP, but do not make architectural choices that prevent it. There are three levels:

**Level 1 — Predefined configurable agents (MVP, build now).** Client enables an agent from a fixed catalog (Waitlist, Follow-up, Recovery, Analytics, and the optional Marketing/Social/Support/Review). Client can edit settings: timing, tone, message templates, triggers, frequency. Client CANNOT invent a brand-new agent type. This is the only level built in the MVP.

**Level 2 — Custom Agent Builder (future).** Client creates a new agent: names it, writes its instructions (a custom system prompt), chooses which triggers fire it, and selects which tools it may use. Requires an Agent Builder UI plus a strict per-agent tool-permission system.

**Level 3 — Autonomous agent with Tool Use (future).** A fully autonomous agent (e.g. a "personal secretary") that understands platform context via **Tool Use / function calling** and runs a think → act → observe loop: it reasons, calls a tool, reads the result, reasons again, and repeats until the task is done. Example: "every morning, review today's bookings and remind unconfirmed customers" → the agent calls `getBookings()`, sees who's unconfirmed, calls `sendMessage()` for each, then stops. Examples clients will want: personal secretary, social-media marketer, content/tweet writer.

### Tool Use design (must be future-ready)
- Define platform capabilities as **tools** (functions) the model can call, each with a clear schema/description. Examples: `getBookings`, `getCustomers`, `getReports`, `sendMessage`, `createBooking`, `updateBooking`. Each tool is a real, audited server function.
- An agent has an explicit **allowed-tools list**. It can ONLY call tools it was granted. A read-only secretary gets read tools; a full secretary also gets action tools. Enforce this server-side, not in the prompt.
- **Tenant isolation is enforced inside every tool**: each tool automatically scopes to the agent's `businessId`. A tool can NEVER read or write another tenant's data, regardless of what the model requests. This is non-negotiable.
- The agentic loop runs server-side in a worker, with a hard cap on iterations and token budget per run, and every tool call logged in `AgentLog`. Respect the credit system — abort if balance is exhausted.
- Custom agents (Level 2/3) are governed by the same credit billing, the same plugin interface, and the same Sentry/audit logging as core agents.

### What this means for the MVP build
- Keep the `AgentPlugin` interface generic enough to later accept a `tools[]` capability list and a loop runner.
- Do NOT hardcode assumptions that an agent is always single-shot — leave room for multi-step (loop) execution.
- Store agent definitions (type, config, and a future `customPrompt` + `allowedTools`) in the existing `Agent` model; extend it when Level 2 is built rather than redesigning it.

## 11. BOOKING SYSTEM RULES

- A business adds **Services**: name (En/Ar), duration, price, **buffer time** (prep/cleanup after each booking — competitors lack this), **max capacity per slot** (1 = individual, N = group sessions like classes/yoga), visibility toggle, optional image.
- **Availability** per service: day-of-week, start/end time, slot length. Plus business-level holidays/closures.
- **Staff** can be linked to services ("book with Dr. Ahmed specifically"); staff have leaves/unavailability.
- **Slot capacity**: each slot tracks max / booked / remaining; auto-closes when full.
- **Waitlist**: when a slot is full, customer joins the waitlist (configurable max length + offer-expiry window). Smart offers on cancel/no-show.
- **Booking lifecycle**: `PENDING → CONFIRMED → ATTENDED / NO_SHOW / CANCELLED`. Waitlist: `WAITING → OFFERED → CONFIRMED / EXPIRED / CANCELLED`.
- **No-show handling**: record it, free the slot (trigger waitlist), update the customer's `noShowScore`. Owners can block repeat offenders.
- **Customer intelligence**: auto-computed `noShowScore`, `loyaltyScore`, `isVIP`, full history, internal notes (hidden from customer).
- **Confirmation problem** (the original pain point): bookings depend on the customer physically arriving — solve with reminders (24h + 1h), a confirm action, and attendance tracking.

---

## 12. UX / USER STORIES (must follow best practices)

The platform MUST compete on experience. Follow these journeys precisely.

### Tenant onboarding (after registration)
Choose default language → choose business type (loads a TEMPLATE: pre-filled services, hours, settings for that vertical — clinic vs salon vs fitness) → set business name + claim slug (live subdomain availability check) → upload logo + brand color → add first service(s) → set availability → preview public page → done in minutes.

### Tenant dashboard sections (7)
Home (today + KPIs + alerts + active waitlist), Bookings (calendar + table + confirm/cancel/no-show + manual booking), Services (with buffer + capacity), Customers (smart profiles, scores, notes, block), Staff (link services, leaves, performance), Reports (revenue, attendance, peak hours, **waitlist conversion**, export), Agents (manage/configure AI agents + logs), Settings (business, domain, notifications, AI config, billing, language).

### Public booking journey (customer)
Land on business page → see services (price/duration) → pick service → see available days/slots → pick slot (or join waitlist if full) → enter name + phone → confirm → instant WhatsApp confirmation + reminders.

### Super admin
Overview (MRR, churn, active businesses), businesses management, plans/pricing, agent store, revenue reports, queue monitoring (BullMQ), Sentry logs, platform language default.

---

## 13. FRONTEND DESIGN STANDARDS (must be beautiful & professional)

- **Quality bar**: production-grade, visually striking, NOT generic "AI slop". Every screen should feel intentionally designed.
- **Adaptable to any vertical**: the tenant landing page and dashboard must look great whether the business is a luxury clinic, a trendy salon, or a fitness studio. Use the tenant's brand color as an accent; clean, modern, flexible layout.
- **Tenant public landing page**: modern, fast, mobile-first, conversion-focused. Hero with business name/logo/brand color, services grid, clear availability + booking CTA, trust signals. Bilingual with locale-aware direction.
- **Dashboard**: clean sidebar navigation, KPI cards, data tables with filters, calendar views, generous whitespace, accessible.
- **Components**: build on shadcn/ui; consistent design tokens; dark mode support.
- **Typography**: distinctive, readable in BOTH Latin and Arabic scripts (pick fonts with strong Arabic support, e.g. a quality Arabic typeface paired with a clean Latin one).
- **RTL/LTR**: every component works perfectly in both directions — test both.
- **Motion**: purposeful micro-interactions and page-load reveals; never gratuitous.
- **Accessibility**: semantic HTML, keyboard nav, ARIA where needed, sufficient contrast.

---

## 14. PROJECT STRUCTURE (App Router)

```
src/
  app/
    (marketing)/        # public SaaS site — admin-set default language
    (auth)/             # login, register, forgot, verify, onboarding
    (dashboard)/        # tenant dashboard (protected) — client language
    (admin)/            # super admin (protected) — admin language
    [slug]/             # public tenant booking portal (+ custom domain)
    api/                # route handlers + webhooks (moyasar, twilio)
  lib/                  # prisma, redis, auth, ai, storage, notification, payment, i18n
  agents/               # AgentPlugin base + agents + registry
  workers/              # BullMQ workers + crons (separate process)
  components/           # ui (shadcn), dashboard, booking, agents
  middleware/           # tenant resolution, route protection
  types/
messages/               # en.json (primary), ar.json (secondary)
prisma/                 # schema.prisma, migrations, seed.ts
```

---

## 15. BUILD ORDER (vertical slices — each must WORK end to end)

Build step by step. Confirm each slice runs before moving on. Wire backend to UI as you go — no "infra now, UI later" gaps.

1. **Foundation** — Next.js + i18n (en/ar, RTL/LTR) + Prisma schema + Auth + middleware (tenant + route protection) + Sentry + Docker for 3 envs.
2. **Billing & Onboarding** — Plans, Moyasar subscription, onboarding wizard (language → type template → slug check → branding), subdomain routing.
3. **Core Dashboard** — Services (buffer, capacity, En/Ar), Availability, Staff, public landing page, Booking engine.
4. **Waitlist + Notifications** — BullMQ, waitlist logic, Resend email, Twilio WhatsApp/SMS, reminders.
5. **AI Agents** — AgentPlugin interface, Waitlist/Follow-up/Recovery/Analytics agents, credit billing, cron jobs.
6. **Reports + Analytics Agent** — revenue, attendance, peak hours, waitlist conversion, weekly AI report.
7. **Custom Domains + Security hardening + Optional agents + Launch** — A-record/TXT verification + masking, rate limiting, audit log, agent store, beta.
8. **(Post-launch) Custom Agent Builder** — Level 2/3 from section 10.5: Tool Use framework, per-agent tool permissions, agentic loop runner, Agent Builder UI. Only after the platform is stable.

---

## 16. WORKING AGREEMENT WITH CLAUDE CODE

- Use **Claude Opus 4.8**.
- Go **step by step**; after each slice, summarize what was built and confirm it runs.
- Ask before introducing any new dependency or deviating from this document.
- Write tests for critical paths (booking creation, waitlist offer, credit deduction, tenant isolation).
- Keep the codebase English; keep all user-facing text in i18n files.
- Treat tenant isolation and webhook signature verification as security-critical — never cut corners there.
