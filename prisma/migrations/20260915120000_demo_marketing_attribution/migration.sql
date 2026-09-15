-- Additive nullable fields; existing leads and application versions remain valid.
ALTER TABLE "SalesLead"
ADD COLUMN "campaignSource" TEXT,
ADD COLUMN "campaignMedium" TEXT,
ADD COLUMN "campaignName" TEXT,
ADD COLUMN "gclid" TEXT,
ADD COLUMN "fbclid" TEXT,
ADD COLUMN "landingPage" TEXT,
ADD COLUMN "attributionRecordedAt" TIMESTAMP(3);
