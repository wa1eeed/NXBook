// ============================================================
// Sentry — Edge runtime init (middleware, edge routes).
// No-ops when no real DSN is configured.
// ============================================================

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN
const enabled = !!dsn && !dsn.startsWith("TODO")

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  })
}
