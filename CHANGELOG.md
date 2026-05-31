# Changelog

All notable changes to NXBook. The project is built in **vertical slices**
(CLAUDE.md §15): each slice works end-to-end before the next begins.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Done
- **Documentation pass** — README, CHANGELOG, CONTRIBUTING, `.env.example`,
  and `docs/{ARCHITECTURE,DEVELOPMENT,DEPLOYMENT,WEBHOOKS}.md`.

### Deferred → Phase 2 (registered, not started — see [docs/ROADMAP.md](docs/ROADMAP.md))
- **Public REST API + Developer Portal** — per-tenant API keys, `/api/v1/*`
  endpoints wrapping the existing service layer, per-key rate limiting, OpenAPI
  spec, a `/developers` docs page, and signed outbound webhooks.

### Deferred → Phase 3
- **Custom Agent Builder** (Level 2/3) — client-authored agents with a
  per-agent tool-permission system and an agentic loop runner.

---

## Slice 7 — Custom Domains + Security + Launch
### Added
- Security headers in `next.config.ts`: CSP, HSTS (production), X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- Redis-backed rate limiting (`src/lib/ratelimit.ts`), fail-open, with per-IP
  presets; wired into public booking, waitlist join, and registration.
- Audit log (`AuditLog` model + `src/lib/audit.ts`) on booking cancel/no-show,
  agent toggles, business updates, and domain operations.
- Custom domains (`src/lib/domains.ts`): add → DNS TXT verification
  (`_nxbook-verify`) → activate, with transparent domain masking via
  `/api/resolve-domain` and middleware rewrite.
- Real `/dashboard/settings` (business profile + custom-domain management).

## Slice 6 — Reports + Analytics UI
### Added
- `src/lib/reports.ts` — tenant-scoped metrics: revenue, attendance/no-show/
  cancel rates, peak hours, daily volume, top services, and the flagship
  **waitlist conversion / "revenue saved."**
- `/dashboard/reports` — KPI cards, pure-CSS bar charts (no chart dependency),
  the waitlist-impact headline, period selector (7/30/90d), weekly AI report
  view, and CSV export.

## Slice 5 — AI Agents
### Added
- `AgentPlugin` base + registry + credit-gated runner (`src/agents/`).
- Four core agents: Waitlist, Follow-up, Recovery, Analytics.
- `src/lib/ai-guard.ts` — metered AI calls with a template fallback when no key
  is configured (never throws).
- Agent triggers (event / delayed / cron) wired into the workers process and
  the booking + waitlist flows.
- `/dashboard/agents` — enable/disable, run-now, recent runs, credit balance.

## Slice 4 — Waitlist + Notifications
### Added
- BullMQ queues + a separate workers process (`src/workers/index.ts`) with a
  node-cron offer sweep.
- Waitlist domain logic: join → auto-offer on cancel/no-show → confirm → expire.
- Notification dispatch guard (`src/lib/notify.ts`) — WhatsApp/email that logs
  `skipped` until Twilio/Resend keys exist.
- Booking lifecycle: confirm/attend/cancel/no-show + 24h/1h reminders +
  no-show scoring.
- Real `/dashboard/bookings`, public waitlist join, `/waitlist/[id]/confirm`.

## Slice 3 — Core Dashboard
### Added
- Dashboard shell + sidebar; Services CRUD (bilingual, buffer, capacity);
  per-service availability editor; Staff CRUD + service linking.
- Booking engine (`src/lib/booking.ts`): slot generation + capacity tracking.
- Public booking flow on `/[slug]`.

## Slice 2 — Billing & Onboarding
### Added
- Registration + login (NextAuth v5), 4-step onboarding wizard with vertical
  templates, live slug availability check.
- Plans/pricing page + Moyasar subscription checkout.
- Tenant landing page on `/[slug]`; subdomain routing.

## Slice 1 — Foundation
### Added
- Next.js 15 + TypeScript + Tailwind v4 scaffold.
- next-intl (cookie-driven en/ar, automatic RTL/LTR).
- Prisma schema + migrations, NextAuth, middleware (tenant + route protection).
- Sentry across dev/staging/production; Docker for all three.
