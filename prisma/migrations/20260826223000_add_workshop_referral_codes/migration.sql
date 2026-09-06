ALTER TABLE "Workshop"
  ADD COLUMN "referralCode" TEXT,
  ADD COLUMN "referredByWorkshopId" TEXT,
  ADD COLUMN "referralCodeUsed" TEXT;

CREATE UNIQUE INDEX "Workshop_referralCode_key" ON "Workshop"("referralCode");
CREATE INDEX "Workshop_referredByWorkshopId_idx" ON "Workshop"("referredByWorkshopId");

ALTER TABLE "Workshop"
  ADD CONSTRAINT "Workshop_referredByWorkshopId_fkey"
  FOREIGN KEY ("referredByWorkshopId") REFERENCES "Workshop"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
