CREATE TYPE "AcquisitionSource" AS ENUM ('sales_advisor', 'instagram', 'website', 'google', 'referral', 'field_visit', 'partner', 'other', 'unknown');

ALTER TABLE "Workshop" ADD COLUMN "acquisitionSource" "AcquisitionSource" NOT NULL DEFAULT 'unknown';
ALTER TABLE "Workshop" ADD COLUMN "acquisitionAdvisorId" TEXT;

CREATE INDEX "Workshop_acquisitionSource_idx" ON "Workshop"("acquisitionSource");
CREATE INDEX "Workshop_acquisitionAdvisorId_idx" ON "Workshop"("acquisitionAdvisorId");
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_acquisitionAdvisorId_fkey" FOREIGN KEY ("acquisitionAdvisorId") REFERENCES "SalesAdvisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
