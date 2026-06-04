# Roadmap

## ✅ Phase 1 — Core platform (COMPLETE)

All seven core build slices (CLAUDE.md §15) plus the documentation pass are
done. The platform is **feature-complete** and only needs real API keys pasted
to go fully live.

1. Foundation · 2. Billing & Onboarding · 3. Core Dashboard ·
4. Waitlist & Notifications · 5. AI Agents · 6. Reports · 7. Security & Custom
Domains · + Documentation.

---

## ✅ UX/Product Expansion — 8 phases (COMPLETE, 2026-06-04)

Shipped on top of Phase 1. Full detail in `CHANGELOG.md`. Summary:

1. **Calendar as default bookings view** — month/week/day, day-detail side
   panel, filters (service/staff/customer).
2. **Customer detail page** — `/dashboard/customers/[id]` with Profile /
   Timeline / Bookings / Statistics tabs.
3. **Notification Center** — `InAppNotification` model, header bell with
   30s polling, `/dashboard/notifications` page.
4. **Subscription enforcement + billing** — `subscription-guard` (fail-open),
   trial/grace banners, `/dashboard/billing`, monthly/yearly pricing,
   admin extend-trial.
5. **Public page + confirmation** — social/location/meeting config,
   `/[slug]/confirmation/[bookingId]` with ICS + share + cancel.
6. **Admin** — `/admin/subscriptions`, business-detail trial controls.
7. **Manual booking** — calendar quick-add (date prefill) + send-confirmation
   toggle.
8. **Responsive + micro-interactions** — global utilities, RTL/dark-mode audit.

Three new migrations: `in_app_notifications`, `subscription_enforcement`,
`business_public_config`.

---

## ⏭️ Phase 2 — Public API + Developer Portal (DEFERRED — not started)

> **Status:** registered for later. Do **not** start without an explicit go.
> The architecture already supports it: business logic lives in the reusable
> service layer (`src/lib`, `src/agents`), tenant isolation runs through
> `businessId`, and Phase-1 Slice-7 security (rate limiting, audit log, headers)
> is its foundation. This is additive — zero risk to the working platform.

Goal: let any third party integrate with NXBook through a documented,
self-serve REST API.

### Scope
- **Per-tenant API keys** — generate / revoke, hashed at rest, optional scopes
  (read vs write), shown once on creation. New model (e.g. `ApiKey`) +
  dashboard UI under Settings.
- **API auth middleware** — separate from NextAuth session auth; resolves the
  tenant from the API key (Authorization: Bearer) and injects `businessId`.
- **REST endpoints** `/api/v1/*` — thin wrappers over the existing service
  layer, all tenant-scoped:
  - `GET/POST /api/v1/bookings`, `PATCH /api/v1/bookings/:id` (lifecycle)
  - `GET/POST /api/v1/services`, `/api/v1/services/:id/availability`
  - `GET/POST /api/v1/customers`
  - `GET /api/v1/availability` (public slot lookup)
  - `GET /api/v1/reports`
- **Per-API-key rate limiting** — reuse `src/lib/ratelimit.ts` keyed by API key.
- **OpenAPI 3 spec** — machine-readable contract (`/api/v1/openapi.json`).
- **Developer Portal** — a `/developers` page: getting started, auth, endpoint
  reference (rendered from the OpenAPI spec), code samples (curl + JS), and key
  management.
- **Outbound webhooks** — tenant-configurable, signed with a per-tenant secret:
  `booking.created`, `booking.cancelled`, `booking.no_show`,
  `waitlist.confirmed`, etc. Delivery + retry via the existing BullMQ workers.
- **Audit + docs** — every API action audit-logged; this roadmap entry promoted
  to a CHANGELOG release when shipped.

### Why it's safe to defer
Nothing in Phase 1 depends on it. When Phase 2 begins it adds a new auth path
and new routes on top of unchanged service functions — the booking platform
keeps working throughout.

---

## 🛡️ Account Security Hardening (REGISTERED — not started)

> **Status:** registered for later. These three items address known gaps in the
> auth flow. They were deferred to unblock the production launch — until they
> ship, new accounts are auto-verified at registration and password reset is
> not available. **Email + auth slice should be done as a single coordinated
> piece** because items 1 and 2 share the Resend transactional-email pipeline.

### 1. Email verification flow (Resend)
- **Why:** today anyone can register with any email (even one that isn't
  theirs) because `isVerified` is forced to `true` in
  `src/app/(auth)/register/actions.ts`. This was a temporary unblock — the
  comment in that file flags it.
- **Scope:**
  - Revert `isVerified` back to `process.env.NODE_ENV !== "production"`.
  - Send a verification email via Resend on registration containing a signed
    one-time link `/verify-email?token=…` (token already generated via
    `verifyToken` column on `User`).
  - Build `/verify-email/page.tsx` server-side route handler that validates
    the token, sets `isVerified=true`, clears the token, and redirects to
    `/onboarding`.
  - Re-send verification action (rate-limited) for users stuck at unverified.
  - i18n: `auth.verifyEmail.*` strings (subject, body, CTA, success, expired).
  - Migration to verify any pre-existing legacy accounts in a single batch
    when the slice ships, so live users don't get locked out.

### 2. Forgot password flow
- **Why:** there is currently no way to recover a forgotten password — the
  `/forgot-password` placeholder route is unimplemented.
- **Scope:**
  - `/forgot-password` form → server action issues a signed reset token
    (TTL 1h), stores hash on `User` (new column `resetTokenHash`,
    `resetTokenExpiresAt`).
  - Send reset email via Resend (same pipeline as verification).
  - `/reset-password?token=…` form → validates token, sets new
    `passwordHash`, clears the token, invalidates any other live sessions.
  - Rate-limit per IP **and** per email to prevent enumeration / spam.
  - i18n: `auth.forgotPassword.*` / `auth.resetPassword.*`.

### 3. Per-account login rate limiting
- **Why:** today `src/lib/ratelimit.ts` is wired into `/login` per-IP only
  (`LIMITS.auth`). An attacker rotating proxies can still brute-force a
  single account.
- **Scope:**
  - Add per-email key (`auth:email:<lowercased>`) on top of per-IP, with a
    stricter window (e.g. 5 attempts / 15 min).
  - On lockout, return a generic "too many attempts" error (do **not** leak
    whether the email exists).
  - Optional `User.failedLoginAttempts` + `lockedUntil` columns for a
    persistent lock that survives Redis restarts.
  - Surface in the audit log (`recordAudit("auth.lockout", ...)`).
  - Reset the counter on a successful login.

### Why it's safe to defer
Items 1 and 2 are user-experience improvements over an account model that
already works — registration + login succeed today. Item 3 is a defense-in-
depth measure; current per-IP limits + bcrypt rounds (12) already make
brute-force expensive. All three are additive — no schema redesign, no
behavior change for the booking platform itself.

---

## 🔮 Phase 3 — Custom Agent Builder (future, CLAUDE.md §10.5)

Level 2/3 autonomous agents: client-authored agents with a per-agent
tool-permission system and an agentic (think → act → observe) loop runner. The
`AgentPlugin` interface is already designed to accept this without a redesign
(`allowedTools` + multi-step execution).
