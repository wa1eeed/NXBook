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

  // ── Migrations: which are applied / failed / pending ──────
  // The Prisma client itself caches the schema, so a missing column
  // shows up as a runtime error on real queries; this surfaces the
  // truth directly from _prisma_migrations.
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        migration_name: string
        finished_at: Date | null
        rolled_back_at: Date | null
      }>
    >`SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY started_at DESC LIMIT 10`
    checks.migrations = rows.map((r) => ({
      name: r.migration_name,
      state: r.rolled_back_at
        ? "rolled_back"
        : r.finished_at
          ? "applied"
          : "pending_or_failed",
    }))
    const stuck = rows.filter(
      (r) => !r.finished_at && !r.rolled_back_at,
    )
    if (stuck.length > 0) {
      checks.ok = false
      checks.migrationError = `Stuck migrations: ${stuck.map((s) => s.migration_name).join(", ")}`
    }
  } catch (err) {
    checks.migrationsCheck = "FAILED"
    checks.migrationsCheckError = err instanceof Error ? err.message : String(err)
  }

  // ── Schema feature checks (catch missing columns explicitly) ──
  try {
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Service' AND column_name = 'paymentMode'
    `
    checks.schema = {
      Service_paymentMode: cols.length > 0 ? "present" : "MISSING — migration 20260601090000_service_payment_mode not applied",
    }
    if (cols.length === 0) checks.ok = false
  } catch (err) {
    checks.schemaCheckError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(checks, { status: checks.ok ? 200 : 503 })
}
