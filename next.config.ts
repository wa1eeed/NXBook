import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import { withSentryConfig } from "@sentry/nextjs"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

// Security headers (CLAUDE.md §7). CSP is intentionally permissive enough
// for Next.js (inline styles, data: images) while blocking framing and
// mixed content. HSTS only meaningfully applies over HTTPS in production.
const isProd = process.env.NODE_ENV === "production"

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs inline/eval for its runtime; tighten with nonces later.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // API calls: self + provider endpoints used by the app/agents.
      "connect-src 'self' https://api.moyasar.com https://*.sentry.io",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://api.moyasar.com",
    ].join("; "),
  },
]

const nextConfig: NextConfig = {
  // Standalone build for the Docker runner stage (see Dockerfile).
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

// Sentry wraps the base config FIRST, then next-intl wraps the result.
// next-intl must be the outermost plugin so its request-config alias survives
// (Sentry-outermost clobbers it → "Couldn't find next-intl config file").
const sentryWrapped = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  disableLogger: true,
})

export default withNextIntl(sentryWrapped)
