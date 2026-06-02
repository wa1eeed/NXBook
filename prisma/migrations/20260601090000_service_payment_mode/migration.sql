-- CreateEnum (idempotent — survives a partial replay)
DO $$ BEGIN
  CREATE TYPE "ServicePaymentMode" AS ENUM ('ON_ARRIVAL', 'ONLINE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable (idempotent — IF NOT EXISTS avoids re-failing on retry)
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "paymentMode" "ServicePaymentMode" NOT NULL DEFAULT 'ON_ARRIVAL';

-- Pre-clean: if any tenant accidentally created two identical availability
-- windows for the same (service, day, start time), drop the duplicates
-- BEFORE adding the unique index — otherwise the migration fails and the
-- whole deploy aborts. Keeps the oldest (lowest id) row.
DELETE FROM "ServiceAvailability" a
USING "ServiceAvailability" b
WHERE a.id > b.id
  AND a."serviceId" = b."serviceId"
  AND a."dayOfWeek" = b."dayOfWeek"
  AND a."startTime" = b."startTime";

-- CreateIndex (idempotent — skip if already there from a prior attempt)
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceAvailability_serviceId_dayOfWeek_startTime_key"
  ON "ServiceAvailability"("serviceId", "dayOfWeek", "startTime");
