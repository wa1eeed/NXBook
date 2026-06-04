-- AlterTable: add gracePeriodHours to Subscription
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "gracePeriodHours" INTEGER NOT NULL DEFAULT 48;
