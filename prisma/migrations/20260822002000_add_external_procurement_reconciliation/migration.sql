ALTER TABLE "ExternalProcurementOrder"
  ADD COLUMN "nextReconcileAt" TIMESTAMP(3),
  ADD COLUMN "reconcileFailureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastReconcileError" TEXT,
  ADD COLUMN "manualReconcileRequiredAt" TIMESTAMP(3);

CREATE INDEX "ExternalProcurementOrder_provider_nextReconcileAt_idx"
  ON "ExternalProcurementOrder"("provider", "nextReconcileAt");

CREATE TABLE "ExternalProcurementEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "contractVersion" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "externalOrderId" TEXT NOT NULL,
  "partnerVersion" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "failureCode" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "ExternalProcurementEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalProcurementEvent_provider_eventId_key"
  ON "ExternalProcurementEvent"("provider", "eventId");
CREATE INDEX "ExternalProcurementEvent_provider_externalOrderId_partnerVersion_idx"
  ON "ExternalProcurementEvent"("provider", "externalOrderId", "partnerVersion");
CREATE INDEX "ExternalProcurementEvent_status_receivedAt_idx"
  ON "ExternalProcurementEvent"("status", "receivedAt");
