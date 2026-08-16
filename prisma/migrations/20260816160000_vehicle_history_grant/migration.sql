-- CreateTable
CREATE TABLE "VehicleHistoryGrant" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "vin" TEXT,
    "grantedByUserId" TEXT,
    "ocrLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleHistoryGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleHistoryGrant_workshopId_idx" ON "VehicleHistoryGrant"("workshopId");

-- CreateIndex
CREATE INDEX "VehicleHistoryGrant_plate_idx" ON "VehicleHistoryGrant"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleHistoryGrant_workshopId_plate_key" ON "VehicleHistoryGrant"("workshopId", "plate");

-- CreateIndex
CREATE INDEX "Vehicle_plate_idx" ON "Vehicle"("plate");

-- AddForeignKey
ALTER TABLE "VehicleHistoryGrant" ADD CONSTRAINT "VehicleHistoryGrant_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

