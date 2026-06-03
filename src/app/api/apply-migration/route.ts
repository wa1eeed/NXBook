// ONE-TIME migration endpoint — DELETE THIS FILE after use.
// Protected by MIGRATION_SECRET env var (set in Coolify before calling).
// Applies the 20260601090000_service_payment_mode migration manually
// when prisma migrate deploy can't run it automatically.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  // ── Auth guard ──────────────────────────────────────────────
  const secret = process.env.MIGRATION_SECRET
  if (!secret) {
    return NextResponse.json({ error: "MIGRATION_SECRET not set" }, { status: 500 })
  }
  const auth = req.headers.get("x-migration-secret")
  if (auth !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const results: string[] = []

  try {
    // ── 1. Check if already applied ─────────────────────────
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Service' AND column_name = 'paymentMode'
    `
    if (cols.length > 0) {
      return NextResponse.json({
        ok: true,
        message: "paymentMode column already exists — nothing to do.",
      })
    }

    // ── 2. Create enum ───────────────────────────────────────
    await prisma.$executeRawUnsafe(
      `CREATE TYPE "ServicePaymentMode" AS ENUM ('ON_ARRIVAL', 'ONLINE')`
    )
    results.push("✓ Created enum ServicePaymentMode")

    // ── 3. Add column ────────────────────────────────────────
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Service"
         ADD COLUMN "paymentMode" "ServicePaymentMode" NOT NULL DEFAULT 'ON_ARRIVAL'`
    )
    results.push("✓ Added Service.paymentMode column")

    // ── 4. De-duplicate availability rows ───────────────────
    const deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM "ServiceAvailability" a
       USING  "ServiceAvailability" b
       WHERE  a.id > b.id
         AND  a."serviceId"  = b."serviceId"
         AND  a."dayOfWeek"  = b."dayOfWeek"
         AND  a."startTime"  = b."startTime"`
    )
    results.push(`✓ Removed ${deleted} duplicate availability rows`)

    // ── 5. Unique index ──────────────────────────────────────
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "ServiceAvailability_serviceId_dayOfWeek_startTime_key"
         ON "ServiceAvailability"("serviceId", "dayOfWeek", "startTime")`
    )
    results.push("✓ Created unique index on ServiceAvailability")

    // ── 6. Record in _prisma_migrations so deploy doesn't re-run it
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        (gen_random_uuid(),
         'manual-apply-20260601090000',
         now(),
         '20260601090000_service_payment_mode',
         null, null, now(), 1)
      ON CONFLICT (migration_name) DO NOTHING
    `)
    results.push("✓ Recorded migration in _prisma_migrations")

    return NextResponse.json({ ok: true, steps: results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg, completed: results }, { status: 500 })
  }
}
