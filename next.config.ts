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

// ── Docker build optimisation ─────────────────────────────────────────
// DOCKER_BUILD=1 is injected by the Dockerfile so we can skip the
// heavy TypeScript / ESLint re-check passes during image creation.
// We already verify types via `tsc --noEmit` locally and in CI.
// Skipping these in the Docker builder saves ~600 MB of peak heap and
// prevents intermittent OOM kills on the Coolify VPS where the build
// container shares RAM with the live app + db + redis.
const isDockerBuild = process.env.DOCKER_BUILD === "1"

const nextConfig: NextConfig = {
  // Standalone build for the Docker runner stage (see Dockerfile).
  output: "standalone",

  // Skip TS + ESLint checks inside Docker — cuts peak build memory by ~30%.
  // Local development, CI, and the pre-push hook all still run them.
  ...(isDockerBuild && {
    typescript: { ignoreBuildErrors: true },
    eslint: { ignoreDuringBuilds: true },
  }),

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

// Sentry wraps the base config FIRST, then next-intl wraps the result.
// next-intl must be the outermost plugin so its request-config alias survives
// (Sentry-outermost clobbers it → "Couldn't find next-intl config file").
//
// Source-map upload: only when a real auth token is available (not in Docker
// builder stage where SENTRY_AUTH_TOKEN is blanked, and not when the token
// is a TODO placeholder). Upload failures must never block the build.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const hasSentryAuth =
  !!sentryAuthToken &&
  sentryAuthToken !== "" &&
  !sentryAuthToken.startsWith("TODO")

const sentryWrapped = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: hasSentryAuth ? sentryAuthToken : undefined,
  // Always silent — avoids spurious output in CI and Coolify build logs.
  silent: true,
  disableLogger: true,
  sourcemaps: {
    // Delete local .map files after upload so they don't ship to clients.
    deleteSourcemapsAfterUpload: true,
    // If there's no auth token don't generate or upload source maps at all.
    // In Docker (SENTRY_AUTH_TOKEN="") this prevents any network calls.
    disable: !hasSentryAuth,
  },
})

export default withNextIntl(sentryWrapped)
