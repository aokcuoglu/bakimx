-- CreateTable: IntakeTimelineEvent
CREATE TABLE "IntakeTimelineEvent" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "intakeFormId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntakeTimelineEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IntakeTimelineEvent_workshopId_idx" ON "IntakeTimelineEvent"("workshopId");
CREATE INDEX "IntakeTimelineEvent_intakeFormId_idx" ON "IntakeTimelineEvent"("intakeFormId");
CREATE INDEX "IntakeTimelineEvent_eventType_idx" ON "IntakeTimelineEvent"("eventType");
CREATE INDEX "IntakeTimelineEvent_createdAt_idx" ON "IntakeTimelineEvent"("createdAt");
ALTER TABLE "IntakeTimelineEvent" ADD CONSTRAINT "IntakeTimelineEvent_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntakeTimelineEvent" ADD CONSTRAINT "IntakeTimelineEvent_intakeFormId_fkey" FOREIGN KEY ("intakeFormId") REFERENCES "VehicleIntakeForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: VehiclePassportToken
CREATE TABLE "VehiclePassportToken" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "showServiceHistory" BOOLEAN NOT NULL DEFAULT true,
    "showWorkOrders" BOOLEAN NOT NULL DEFAULT true,
    "showDamages" BOOLEAN NOT NULL DEFAULT true,
    "showPhotos" BOOLEAN NOT NULL DEFAULT true,
    "showReminders" BOOLEAN NOT NULL DEFAULT true,
    "showPaymentStatus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehiclePassportToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VehiclePassportToken_token_key" ON "VehiclePassportToken"("token");
CREATE INDEX "VehiclePassportToken_workshopId_idx" ON "VehiclePassportToken"("workshopId");
CREATE INDEX "VehiclePassportToken_vehicleId_idx" ON "VehiclePassportToken"("vehicleId");
CREATE INDEX "VehiclePassportToken_token_idx" ON "VehiclePassportToken"("token");
ALTER TABLE "VehiclePassportToken" ADD CONSTRAINT "VehiclePassportToken_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehiclePassportToken" ADD CONSTRAINT "VehiclePassportToken_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
