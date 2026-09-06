CREATE TYPE "SalesLeadLocationSource" AS ENUM ('google_place', 'manual_pin');

ALTER TABLE "SalesLead"
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "route" TEXT,
  ADD COLUMN "streetNumber" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "formattedAddress" TEXT,
  ADD COLUMN "googlePlaceId" TEXT,
  ADD COLUMN "latitude" DECIMAL(9, 6),
  ADD COLUMN "longitude" DECIMAL(9, 6),
  ADD COLUMN "locationSource" "SalesLeadLocationSource",
  ADD COLUMN "locationConfirmedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "SalesLead_googlePlaceId_key" ON "SalesLead"("googlePlaceId");

ALTER TABLE "SalesLead"
  ADD CONSTRAINT "SalesLead_location_pair_check"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "SalesLead_location_bounds_check"
  CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  ),
  ADD CONSTRAINT "SalesLead_location_confirmation_check"
  CHECK (
    ("latitude" IS NULL AND "locationSource" IS NULL AND "locationConfirmedAt" IS NULL)
    OR ("latitude" IS NOT NULL AND "locationSource" IS NOT NULL AND "locationConfirmedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "SalesLead_location_source_identity_check"
  CHECK (
    ("locationSource" IS NULL AND "googlePlaceId" IS NULL)
    OR ("locationSource" = 'google_place' AND "googlePlaceId" IS NOT NULL)
    OR ("locationSource" = 'manual_pin' AND "googlePlaceId" IS NULL)
  );
