// ONE-TIME migration endpoint — safe to call repeatedly (idempotent).
// Applies any pending NXBook migrations that `prisma migrate deploy`
// didn't pick up, and records them in _prisma_migrations so future
// deploys skip them. DELETE THIS FILE once production is healthy.
//
// Auth: x-migration-secret header (env MIGRATION_SECRET or the fallback).

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Each migration: name + an idempotent list of SQL statements. Every
// statement is written so re-running is a no-op (IF NOT EXISTS guards).
const MIGRATIONS: { name: string; statements: string[] }[] = [
  {
    name: "20260604120000_in_app_notifications",
    statements: [
      `CREATE TABLE IF NOT EXISTS "InAppNotification" (
        "id" TEXT NOT NULL,
        "businessId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
      )`,
      `DO $do$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'InAppNotification_businessId_fkey'
        ) THEN
          ALTER TABLE "InAppNotification"
            ADD CONSTRAINT "InAppNotification_businessId_fkey"
            FOREIGN KEY ("businessId") REFERENCES "Business"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $do$`,
      `CREATE INDEX IF NOT EXISTS "InAppNotification_businessId_isRead_idx" ON "InAppNotification"("businessId", "isRead")`,
      `CREATE INDEX IF NOT EXISTS "InAppNotification_businessId_createdAt_idx" ON "InAppNotification"("businessId", "createdAt")`,
    ],
  },
  {
    name: "20260604130000_subscription_enforcement",
    statements: [
      `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "gracePeriodHours" INTEGER NOT NULL DEFAULT 48`,
    ],
  },
  {
    name: "20260604140000_business_public_config",
    statements: [
      `ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "socialLinks" JSONB`,
      `ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "locationUrl" JSONB`,
      `ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "meetingConfig" JSONB`,
    ],
  },
]

export async function POST(req: Request) {
  const secret = process.env.MIGRATION_SECRET ?? "nxbook-migrate-paymentmode-2026"
  const auth = req.headers.get("x-migration-secret")
  if (auth !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const results: Record<string, string> = {}

  try {
    // Which migrations are already recorded?
    const applied = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM _prisma_migrations
    `
    const appliedSet = new Set(applied.map((r) => r.migration_name))

    for (const mig of MIGRATIONS) {
      if (appliedSet.has(mig.name)) {
        results[mig.name] = "already recorded"
        continue
      }

      // Run each idempotent statement.
      for (const sql of mig.statements) {
        await prisma.$executeRawUnsafe(sql)
      }

      // Record it so prisma migrate deploy won't try again.
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations"
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (gen_random_uuid(), 'manual-apply', now(), $1, null, null, now(), 1)
         ON CONFLICT (migration_name) DO NOTHING`,
        mig.name,
      )
      results[mig.name] = "applied ✓"
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg, partial: results }, { status: 500 })
  }
}
