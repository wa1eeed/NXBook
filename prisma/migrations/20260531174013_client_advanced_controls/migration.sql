-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentAmount" DOUBLE PRECISION,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentStatus" TEXT;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "cancellationHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "depositPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentConfig" JSONB,
ADD COLUMN     "paymentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentProvider" TEXT;
