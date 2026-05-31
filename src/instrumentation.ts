// ============================================================
// Next.js instrumentation entry. Loads the correct Sentry
// runtime config (Node vs Edge) and wires server error capture.
// ============================================================

import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
