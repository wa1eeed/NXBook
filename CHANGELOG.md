# Changelog

All notable changes to NXBook. The project is built in **vertical slices**
(CLAUDE.md §15): each slice works end-to-end before the next begins.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Done
- **Documentation pass** — README, CHANGELOG, CONTRIBUTING, `.env.example`,
  and `docs/{ARCHITECTURE,DEVELOPMENT,DEPLOYMENT,WEBHOOKS}.md`.

---

## UX/Product Expansion — 8-Phase Build (2026-06-04)

A large feature + UX expansion delivered in eight coordinated phases. Each
phase ended with a green `npm run build`, `tsc=0`, and EN/AR i18n parity.
i18n grew from **858 → 1010** keys (full parity maintained throughout).

### Phase 1 — Calendar as the default bookings view
- `/dashboard/bookings` now opens the **calendar** by default (list is the
  secondary toggle).
- `src/app/dashboard/bookings/calendar-view.tsx` — month / week / day modes:
  - **Month**: day cells show the first 2 customer **names** (+N overflow),
    status-coloured (PENDING amber / CONFIRMED blue / ATTENDED green /
    NO_SHOW red), waitlist badge, today ring. Click → side **panel** (not a
    popup) with that day's bookings sorted by time + inline actions
    (confirm / attend / no-show / cancel) + "Add booking for this day".
  - **Week**: hour-grid timeline (6 AM–10 PM) with name chips per day column.
  - **Day**: vertical timeline with hour markers + full booking cards.
  - Toolbar: prev / next / today nav, service filter, staff filter, customer
    name/phone search.
- `bookings/page.tsx` now also loads `waitlistByDay` counts.

### Phase 2 — Customer detail page with full timeline
- `src/app/dashboard/customers/[id]/` — a full page (replaces the slide-over):
  - Breadcrumb + header (avatar, VIP/blocked badges, phone, email, member-since).
  - **Profile** tab: KPIs (total bookings / spend / avg spend / last visit),
    no-show & loyalty score bars, inline notes editor, VIP + block toggles.
  - **Timeline** tab: every event with timestamp + relative time + type filter
    (booking created/confirmed/attended/no-show/cancelled, waitlist
    joined/offered/confirmed, payment).
  - **Bookings** tab: filterable list + new-booking CTA.
  - **Statistics** tab: top services bar chart + 6-month visit trend.
- Customer list rows now link to `/dashboard/customers/[id]`.

### Phase 3 — Notification Center
- **Schema:** new `InAppNotification` model (migration
  `20260604120000_in_app_notifications`).
- `src/lib/notifications-center.ts` — `createNotification` (never throws) +
  `markRead` / `markAllRead` / `countUnread` / `getNotifications`. Wired into
  `booking-lifecycle.ts` (new booking / cancel / no-show).
- **Bell** in the dashboard header (`notification-bell.tsx`): unread badge,
  animated dropdown, type-coded icons, mark-all-read, **30-second polling**.
- API routes: `GET /api/notifications`, `POST /api/notifications/mark-read`.
- Full page `/dashboard/notifications` (type filter + search + pagination).

### Phase 4 — SaaS subscription enforcement + billing
- **Schema:** `Subscription.gracePeriodHours` (migration
  `20260604130000_subscription_enforcement`); `Plan.trialDays` +
  `isTrialUpgradeForced` already existed.
- `src/lib/subscription-guard.ts` — `checkSubscriptionAccess()` returns
  OK / TRIALING / GRACE_PERIOD / EXPIRED / SUSPENDED / NO_SUBSCRIPTION. It is
  **fail-open** (a query error never locks tenants out).
- Dashboard layout enforces it: EXPIRED → `/pricing?reason=trial_expired`,
  SUSPENDED → `/pricing?reason=suspended`, GRACE_PERIOD / TRIALING(≤3d) →
  `SubscriptionBanner` at the top of every page.
- `/pricing` improved: monthly/yearly toggle with savings %, elevated popular
  plan, trial-expired/suspended banner, per-tier checkout spinner.
- New `/dashboard/billing`: current plan, renewal/trial date, cancel
  (`cancelAtPeriodEnd`) + resume, invoice history. Actions audited.
- Admin: `extendTrialAction` (+14 days) on the business detail page.

### Phase 5 — Enhanced public page + booking confirmation
- **Schema:** `Business.socialLinks` / `locationUrl` / `meetingConfig` (JSON,
  migration `20260604140000_business_public_config`).
- Settings **"Public Page"** tab: social links, Google-Maps location +
  address, default meeting type (in-person / Meet / Teams / Zoom / custom).
  `savePublicPageAction` (requireBusiness + canManage + recordAudit + Zod).
- `/[slug]` footer: social icon row, WhatsApp contact button, location link.
- New `/[slug]/confirmation/[bookingId]`: celebratory confirmation with
  details, location/meeting link, **add-to-calendar** (ICS + Google
  Calendar), **share** (WhatsApp / Telegram / Email), and a cancel action.
  `src/lib/calendar-links.ts` provides the pure ICS/link builders. The public
  booking flow now redirects here on success.

### Phase 6 — Comprehensive admin panel
- New `/admin/subscriptions`: KPIs (active / trialing / cancelled / MRR /
  7-day renewals) + filterable, searchable table linking to business detail.
- Admin sidebar gains a Subscriptions item.
- Business detail: "Extend trial" button. (Overview / bookings / customers /
  revenue / audit tabs and the recharts overview existed already.)

### Phase 7 — Enhanced manual booking creation
- `/dashboard/bookings/new`: date **prefill** from `?date=` (powers the
  calendar quick-add) + a "Send confirmation to customer" toggle that fires
  `onBookingCreated` (WhatsApp + 24h/1h reminders).

### Phase 8 — Responsive design + micro-interactions
- `globals.css` micro-interaction utilities: `.press-feedback`, `.card-lift`,
  `.animate-shake`, `.animate-success-pop`, all gated by
  `prefers-reduced-motion`.
- Verified mobile-first responsiveness + dark mode + zero physical CSS
  (left/right) across all new components (RTL-safe).

### Production fixes (during/after the 8 phases)
- **RSC boundary crash** on the marketing landing page: server `page.tsx`
  passed Lucide icon *functions* to client components → 500. Fixed by passing
  icon **names** resolved via an `ICON_MAP` in `animated-sections.tsx`.
  (Build was green; caught by running the standalone prod server locally.)
- **`/api/apply-migration`** generalized to apply all pending migrations
  idempotently (and record them in `_prisma_migrations`) for cases where the
  Coolify deploy doesn't run `migrate deploy`.

> **Ops note:** the three 2026-06-04 migrations had to be applied **manually**
> to production (via psql) because the Coolify auto-deploy did not run
> `prisma migrate deploy`. Production DB user = `NXBook`, database = `postgres`.
> Root cause of the stalled deploy is still under investigation — see
> `docs/DEPLOYMENT.md`.

---

## Post-Launch — Production Hardening + UX Polish (2026-06-01)

Everything below was added **after Phase 1** during first production deployment
on Hostinger VPS via Coolify.

### Production Deployment Fixes
- **Dockerfile runner stage** — bundled `node_modules/effect` (required by
  `@prisma/config`) and `node_modules/tsx` (required by `prisma db seed`) which
  were missing from the standalone image and caused `migrate deploy` / seed to
  fail on startup. Added `node_modules/.bin` to `PATH` so all CLI binaries are
  reachable without absolute paths.
- **`start.sh`** — already ran `prisma migrate deploy` before `node server.js`;
  now works reliably once the missing modules are bundled.
- **`/api/health`** — diagnostics endpoint confirms DB connectivity, table
  existence, and key environment variables (JWT_ENCRYPTION_KEY length,
  ENCRYPTION_KEY length). Used to verify each deployment.

### Auth Flow Fixes
- **Auto-verify on register** — `isVerified` was `false` in production
  (placeholder for the email-verification slice, not yet built), blocking all
  logins. Temporarily set to `true` in all environments until the Resend
  verification slice ships. Comment in `register/actions.ts` flags the revert.
- **Auto-signin after register** — `registerUser` now calls `signIn()` server-
  side immediately after creating the account. The form redirects straight to
  `/onboarding` without a manual login round-trip.
- **Onboarding → Dashboard hard redirect** — replaced `router.push("/dashboard")`
  (which could fire before the refreshed JWT propagated) with
  `window.location.href = "/dashboard"` to force a full-page reload that picks
  up the updated session token. Eliminates the "form disappears but no redirect"
  bug caused by the JWT race condition.

### Marketing Landing Page — Full Redesign
Rebuilt `src/app/page.tsx` from 6 sections to **12 sections**:

| # | Section | What's new |
|---|---|---|
| 1 | **Hero** | Live-pulse badge, mock dashboard preview card with floating agent notification chip, 5-star social proof strip |
| 2 | **Verticals strip** | 6 business-type icons showing the platform covers clinics / salons / fitness / consulting / education / other |
| 3 | **Stats band** | Expanded from 3 to 4 KPIs (+35% show rate, revenue saved, setup time, bilingual) |
| 4 | **The Problem** *(new)* | Emotional hook: ~30% no-show average, 12K SAR lost/month, 4h/week wasted — with red stat cards |
| 5 | **Features grid** | Unchanged 6-card grid |
| 6 | **AI Agents showcase** *(new)* | 4-card section (one per agent) with distinct color tints — positions the agent system as the product's moat |
| 7 | **How it works** | 3-step flow, unchanged |
| 8 | **Revenue Saved** | Flagship card, unchanged |
| 9 | **Voices / testimonials** *(new)* | 3 testimonials with 5-star ratings and role/city attribution |
| 10 | **Pricing teaser** *(new)* | 3-column plan cards with "Most popular" badge linking to /pricing |
| 11 | **FAQ** *(new)* | 6 questions as native `<details>` accordion (no JS, bilingual) |
| 12 | **CTA band** | Enhanced with mesh background and dot pattern |

CSS additions: `bg-hero-mesh`, `bg-dots`, `ring-soft`, `pulse-dot` utility classes.
i18n: 71 new `marketing.*` keys in both en.json and ar.json (122 → 802 total).

### Session-Aware Header (UserMenu)
- **`SiteHeader`** is now session-aware (reads `auth()` server-side):
  - *Signed-out*: shows "Login" (ghost) + "Get Started" (primary) buttons — unchanged.
  - *Signed-in*: replaces both buttons with a **UserMenu** avatar (round circle with initial + ChevronDown).
- **`UserMenu`** (new client component `src/components/marketing/user-menu.tsx`):
  - Click → dropdown with: account email header, role-aware dashboard link (Dashboard / Admin Panel / Complete Setup), Sign out button.
  - Closes on outside click or Escape.
- **Hero and CTA band**: CTAs hidden entirely when signed in — navigation is exclusively via the header. Eliminates duplicate/confusing buttons for returning users.

### Admin Panel Improvements

#### `/admin/businesses/[id]` — New 5-tab detail page
Replaces the old slide-over with a full server-rendered page:
- **Overview**: name, type, slug, subscription status, trial dates, KPIs (bookings this month, total customers, total revenue), Activate/Deactivate + Change Plan actions.
- **Bookings**: filterable table (All/Pending/Confirmed/Attended/No-Show/Cancelled) + attendance rate.
- **Customers**: table with noShowScore/loyaltyScore progress bars + VIP badge.
- **Revenue**: KPI cards + 6-month bar chart + last 10 transactions.
- **Audit & Agents**: last 20 AuditLog entries + active agents + payment gateway status.
- Breadcrumb: Admin → Businesses → [Name]. All mutations guarded by `requireSuperAdmin` + `recordAudit`.

#### `/admin/businesses` — List improvements
- Replaced slide-over with "View Details" → `/admin/businesses/[id]`.
- Added "Last Activity" column (date of most recent booking).

#### `/admin/queues` — Full rebuild
- Collapsible explanation section: what each queue does in plain language.
- One card per queue (notification / reminder / waitlist / agent): icon, description, job counters (Waiting/Active/Delayed/Completed/Failed), red progress bar when failures exist, last 5 failed jobs with error messages, Retry + Clear buttons.
- 30-second auto-refresh.
- Recent activity log: last 20 jobs across all queues.

#### `/admin/customers` — Business column
- Added "Business" column; clicking links to `/admin/businesses/[businessId]`.

### Account Security Hardening (Registered — not started)
Three security improvements identified during launch and registered for a
dedicated future slice. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full
spec. Summary:
1. **Email verification** — revert auto-verify, send Resend link, build `/verify-email` handler.
2. **Forgot password** — Resend reset link, `/reset-password` handler, session invalidation.
3. **Per-account login rate limiting** — per-email Redis key on top of existing per-IP limit, persistent `lockedUntil` column, audit log.

---

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
