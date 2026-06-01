// ============================================================
// Health & diagnostics endpoint — visit /api/health in a browser.
// Reports env presence (booleans only, never values), DB
// connectivity, table existence, and seed status. Safe to expose:
// it never returns secret values, only whether they are set.
// ============================================================
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function envSet(name: string): boolean {
  const v = process.env[name]
  return !!v && !v.startsWith("TODO") && !v.startsWith("CHANGE") && !v.startsWith("GENERATE")
}

export async function GET() {
  const checks: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
  }

  // ── Env presence (booleans only — never leak values) ──────
  checks.env = {
    DATABASE_URL: envSet("DATABASE_URL"),
    NEXTAUTH_SECRET: envSet("NEXTAUTH_SECRET"),
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "(unset)",
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "(unset)",
    JWT_ENCRYPTION_KEY: envSet("JWT_ENCRYPTION_KEY"),
    JWT_ENCRYPTION_KEY_len: (process.env.JWT_ENCRYPTION_KEY ?? "").length,
    ENCRYPTION_KEY: envSet("ENCRYPTION_KEY"),
    ENCRYPTION_KEY_len: (process.env.ENCRYPTION_KEY ?? "").length,
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN ?? "(unset)",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "(unset)",
    NODE_ENV: process.env.NODE_ENV ?? "(unset)",
  }

  // ── DB connectivity ───────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.dbConnect = "ok"
  } catch (err) {
    checks.ok = false
    checks.dbConnect = "FAILED"
    checks.dbError = err instanceof Error ? err.message : String(err)
    // DB unreachable — return early, nothing else will work.
    return NextResponse.json(checks, { status: 503 })
  }

  // ── Tables exist + seed status ────────────────────────────
  try {
    const [users, businesses, plans] = await Promise.all([
      prisma.user.count(),
      prisma.business.count(),
      prisma.plan.count(),
    ])
    checks.tables = "ok"
    checks.counts = { users, businesses, plans }
    if (users === 0) {
      checks.warning = "No users — run `prisma db seed` to create the super-admin."
    }
    if (plans === 0) {
      checks.warning2 = "No plans — run `prisma db seed` to seed plans."
    }
  } catch (err) {
    checks.ok = false
    checks.tables = "FAILED — migrations likely not applied"
    checks.tableError = err instanceof Error ? err.message : String(err)
    return NextResponse.json(checks, { status: 503 })
  }

  return NextResponse.json(checks)
}
