-- CreateTable
CREATE TABLE "InAppNotification" (
    "id"         TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "isRead"     BOOLEAN NOT NULL DEFAULT false,
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InAppNotification"
  ADD CONSTRAINT "InAppNotification_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "InAppNotification_businessId_isRead_idx"
  ON "InAppNotification"("businessId", "isRead");

CREATE INDEX "InAppNotification_businessId_createdAt_idx"
  ON "InAppNotification"("businessId", "createdAt");
