-- Add unique constraint on Vehicle(workshopId, plate) to prevent duplicate plates within a workshop
-- Add index on Vehicle(workshopId, vin) for faster VIN lookups within a workshop

-- Remove any existing duplicates, keeping only the most recently updated entry per (workshopId, plate)
DELETE FROM "Vehicle"
WHERE id IN (
  SELECT v.id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY "workshopId", "plate" ORDER BY "updatedAt" DESC, id DESC) as rn
    FROM "Vehicle"
    WHERE "plate" IS NOT NULL AND "plate" != ''
  ) v
  WHERE v.rn > 1
);

CREATE UNIQUE INDEX "Vehicle_workshopId_plate_key" ON "Vehicle"("workshopId", "plate");
CREATE INDEX "Vehicle_workshopId_vin_idx" ON "Vehicle"("workshopId", "vin");