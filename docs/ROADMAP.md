# Roadmap

## ✅ Phase 1 — Core platform (COMPLETE)

All seven core build slices (CLAUDE.md §15) plus the documentation pass are
done. The platform is **feature-complete** and only needs real API keys pasted
to go fully live.

1. Foundation · 2. Billing & Onboarding · 3. Core Dashboard ·
4. Waitlist & Notifications · 5. AI Agents · 6. Reports · 7. Security & Custom
Domains · + Documentation.

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

## 🔮 Phase 3 — Custom Agent Builder (future, CLAUDE.md §10.5)

Level 2/3 autonomous agents: client-authored agents with a per-agent
tool-permission system and an agentic (think → act → observe) loop runner. The
`AgentPlugin` interface is already designed to accept this without a redesign
(`allowedTools` + multi-step execution).
