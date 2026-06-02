-- CreateEnum
CREATE TYPE "ServicePaymentMode" AS ENUM ('ON_ARRIVAL', 'ONLINE');

-- AlterTable
ALTER TABLE "Service"
  ADD COLUMN "paymentMode" "ServicePaymentMode" NOT NULL DEFAULT 'ON_ARRIVAL';

-- CreateIndex
-- Block duplicate availability windows: same service + day + start time.
CREATE UNIQUE INDEX "ServiceAvailability_serviceId_dayOfWeek_startTime_key"
  ON "ServiceAvailability"("serviceId", "dayOfWeek", "startTime");
