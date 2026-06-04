-- AlterTable: public-page config for Business
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "socialLinks"   JSONB,
  ADD COLUMN IF NOT EXISTS "locationUrl"   JSONB,
  ADD COLUMN IF NOT EXISTS "meetingConfig" JSONB;
