// ============================================================
// Middleware — Route protection + subdomain routing
// ============================================================

import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password",
  "/verify-email", "/pricing", "/about", "/contact"]
const ADMIN_PATHS = ["/admin"]
const AUTH_PATHS = ["/login", "/register"]

export default auth(async (req) => {
  const { pathname, hostname } = req.nextUrl
  const session = req.auth

  // ─── Subdomain routing ─────────────────────────────────
  // business.platform.com → /{slug}
  const appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost").replace(/^www\./, "")
  // Treat the bare domain AND www as "our domain" — not subdomains/foreign.
  const isOwnDomain = hostname === appDomain || hostname === `www.${appDomain}` || hostname === "localhost"
  const isSubdomain = !isOwnDomain && hostname.endsWith(`.${appDomain}`)

  if (isSubdomain) {
    const slug = hostname.replace(`.${appDomain}`, "")
    const url = req.nextUrl.clone()
    url.pathname = `/${slug}${pathname}`
    return NextResponse.rewrite(url)
  }

  // ─── Custom domain masking (CLAUDE.md §6) ──────────────
  // A fully foreign host (not our app domain) → resolve to a tenant
  // slug via the Node API route (edge middleware can't use Prisma),
  // then transparently rewrite so the client's domain stays in the URL.
  const isForeignHost = !isOwnDomain && !isSubdomain

  if (isForeignHost && !pathname.startsWith("/api")) {
    try {
      const res = await fetch(
        new URL(`/api/resolve-domain?host=${encodeURIComponent(hostname)}`, req.url),
      )
      if (res.ok) {
        const { slug } = (await res.json()) as { slug: string | null }
        if (slug) {
          const url = req.nextUrl.clone()
          url.pathname = `/${slug}${pathname}`
          return NextResponse.rewrite(url)
        }
      }
    } catch {
      // fall through to normal handling if resolution fails
    }
  }

  // ─── Redirect logged-in users away from auth pages ────
  if (session && AUTH_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // ─── Protect dashboard ────────────────────────────────
  if (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/bookings") ||
      pathname.startsWith("/services") ||
      pathname.startsWith("/customers") ||
      pathname.startsWith("/staff") ||
      pathname.startsWith("/agents") ||
      pathname.startsWith("/reports") ||
      pathname.startsWith("/settings")) {

    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    // Super-admins have no business → send them to their own panel
    // instead of the tenant onboarding trap.
    if (session.user.role === "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/admin", req.url))
    }

    // Redirect to onboarding if not done
    if (!session.user.onboardingDone && !pathname.startsWith("/onboarding")) {
      return NextResponse.redirect(new URL("/onboarding", req.url))
    }
  }

  // ─── Protect admin ────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
