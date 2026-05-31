# NXBook

> **Booking SaaS that guarantees your customers actually show up.**

NXBook is a multi-tenant booking platform for appointment-based businesses
(clinics, salons, fitness studios, consulting, education). It pairs a complete
booking engine with a **smart waitlist**, **no-show intelligence**, and a layer
of **autonomous AI agents** — answering not just "how do you take a booking?"
but the deeper question: *"how do you guarantee the customer shows up?"*

Bilingual by design: **English (primary) + Arabic (secondary)** with automatic
RTL/LTR throughout.

---

## ✨ Features

- **Booking engine** — services (bilingual, buffer time, per-slot capacity for
  group sessions), weekly availability, staff linking, slot generation, and the
  full lifecycle `PENDING → CONFIRMED → ATTENDED / NO_SHOW / CANCELLED`.
- **Smart waitlist** — when a slot is full, customers join a queue; on a
  cancellation or no-show the next person is auto-offered the slot with a 30-min
  confirm window, then the queue advances. The flagship metric is
  **waitlist conversion / "revenue saved."**
- **Notifications** — WhatsApp + SMS (Twilio) and email (Resend), with 24h/1h
  reminders and instant booking confirmations, run on background workers.
- **AI agents** — Waitlist, Follow-up, Recovery (win-back), and Analytics
  agents on a plugin architecture, metered against a prepaid credit balance.
- **Reports** — revenue, attendance/no-show rates, peak hours, daily volume,
  top services, the waitlist "revenue saved" headline, plus a weekly AI report.
- **Multi-tenancy** — shared schema with strict row-level isolation by
  `businessId`, resolved from the session (never the client).
- **Onboarding** — a 4-step wizard (language → business-type template → slug
  with live availability check → branding) that provisions a tenant in minutes.
- **Billing** — Moyasar subscriptions (SAR) + prepaid AI credits.
- **Custom domains** — connect your own domain with DNS (TXT + A) verification
  and transparent domain masking.
- **Security** — Zod validation everywhere, per-IP/per-tenant rate limiting,
  audit logging, signed webhooks, and CSP/HSTS security headers.

---

## 🧱 Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui (hand-built primitives) |
| i18n | next-intl (cookie-driven, en/ar, RTL/LTR) |
| ORM / DB | Prisma + PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ (+ node-cron) |
| Auth | NextAuth v5 (JWT, multi-role) |
| AI | Anthropic Claude (primary) + OpenAI (fallback) |
| Storage | Cloudflare R2 (S3-compatible) |
| Email / SMS | Resend / Twilio |
| Payments | Moyasar |
| Monitoring | Sentry (3 environments) |
| Hosting | Docker → Coolify (Hostinger) → AWS/Alibaba ready |

---

## 🚀 Quick start

**Prerequisites:** Node 20+, Docker, npm.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (safe local defaults are pre-filled;
#    paste real third-party keys where marked TODO_PASTE_*)
cp .env.development.example .env.development   # already present in this repo
ln -sf .env.development .env                   # Prisma CLI reads .env

# 3. Start Postgres + Redis
docker compose up -d db redis

# 4. Migrate + seed
npm run db:migrate
npm run db:seed

# 5. Run the app + the background workers (two terminals)
npm run dev          # http://localhost:3000
npm run workers      # BullMQ workers + cron
```

The app **boots and runs without any third-party keys** — features that need
them (AI, WhatsApp/SMS, email, payments, uploads) degrade gracefully and log a
`skipped` status until you paste real credentials. See
[`docs/API_KEYS_TODO.md`](docs/API_KEYS_TODO.md) for exactly which keys unlock
which feature.

> **Local ports:** this dev setup maps Postgres to host **5433** and Redis to
> **6380** (defaults 5432/6379 may be taken by another project). Adjust
> `docker-compose.yml` + `.env.development` if you prefer the defaults.

Default seeded super-admin: `admin@nxbook.app` / `Admin@123456`.

---

## 🛠️ Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run workers` | Background workers (BullMQ + cron), watch mode |
| `npm run db:migrate` | Create + apply a dev migration |
| `npm run db:deploy` | Apply migrations (staging/prod) |
| `npm run db:seed` | Seed plans + platform config + super-admin |
| `npm run db:studio` | Prisma Studio |
| `npm run lint` | ESLint |

---

## 📚 Documentation

| Doc | What's inside |
|-----|---------------|
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Multi-tenancy, AI agents, queues, i18n, data model |
| [DEVELOPMENT](docs/DEVELOPMENT.md) | Local setup, project structure, conventions, testing |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Docker, Coolify, environments, migration to AWS/Alibaba |
| [WEBHOOKS](docs/WEBHOOKS.md) | Moyasar + Twilio inbound webhooks, signatures |
| [API_KEYS_TODO](docs/API_KEYS_TODO.md) | Which keys to paste, and where to get them |
| [CONTRIBUTING](CONTRIBUTING.md) | Workflow, commit style, build-slice discipline |
| [CHANGELOG](CHANGELOG.md) | Release history by build slice |

A **Public REST API + Developer Portal** is planned (see the changelog's
roadmap) — the layered architecture is already designed to support it.

---

## 🗺️ Project status

All seven core build slices are complete (Foundation → Billing/Onboarding →
Core Dashboard → Waitlist/Notifications → AI Agents → Reports → Security/Custom
Domains). The platform is **feature-complete**; going fully live only requires
pasting real API keys.

---

## License

Proprietary — © NXBook. All rights reserved.
