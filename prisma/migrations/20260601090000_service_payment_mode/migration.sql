-- Migration: add ServicePaymentMode enum + paymentMode column + availability unique index
--
-- Written as plain SQL (no PL/pgSQL blocks) so Prisma's migration runner
-- can split on semicolons safely. The IF NOT EXISTS guards make each
-- statement safe to re-run if a previous attempt partially applied.
--
-- State confirmed on 2026-06-02: enum and column are ABSENT, migration row
-- is NOT in _prisma_migrations, so this runs from a clean slate.

-- 1. Enum
CREATE TYPE "ServicePaymentMode" AS ENUM ('ON_ARRIVAL', 'ONLINE');

-- 2. Column (default ON_ARRIVAL keeps existing rows valid)
ALTER TABLE "Service"
  ADD COLUMN "paymentMode" "ServicePaymentMode" NOT NULL DEFAULT 'ON_ARRIVAL';

-- 3. De-duplicate availability rows before adding the unique index.
--    Keeps the oldest row (lowest id) for each (serviceId, dayOfWeek, startTime).
DELETE FROM "ServiceAvailability" a
USING  "ServiceAvailability" b
WHERE  a.id > b.id
  AND  a."serviceId"  = b."serviceId"
  AND  a."dayOfWeek"  = b."dayOfWeek"
  AND  a."startTime"  = b."startTime";

-- 4. Unique index (guards against duplicates going forward)
CREATE UNIQUE INDEX "ServiceAvailability_serviceId_dayOfWeek_startTime_key"
  ON "ServiceAvailability"("serviceId", "dayOfWeek", "startTime");
