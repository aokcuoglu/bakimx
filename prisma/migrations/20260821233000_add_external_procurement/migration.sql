CREATE TABLE "ExternalProcurementOrder" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "serviceOrderId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "externalOrderId" TEXT,
  "partnerStatus" TEXT NOT NULL,
  "partnerVersion" INTEGER NOT NULL DEFAULT 0,
  "bindingNetKurus" INTEGER,
  "bindingVatKurus" INTEGER,
  "bindingGrossKurus" INTEGER,
  "currency" TEXT,
  "pricingPolicyVersion" TEXT,
  "reservationExpiresAt" TIMESTAMP(3),
  "invoiceReference" TEXT,
  "cancellationCode" TEXT,
  "failureCode" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "cancellationRequestedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastReconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalProcurementOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalProcurementOrderItem" (
  "id" TEXT NOT NULL,
  "externalProcurementOrderId" TEXT NOT NULL,
  "serviceOrderItemId" TEXT NOT NULL,
  "externalProductId" TEXT NOT NULL,
  "externalOfferId" TEXT NOT NULL,
  "externalOrderItemId" TEXT,
  "quantity" INTEGER NOT NULL,
  "productPresentationSnapshot" JSONB NOT NULL,
  "informationalSnapshot" JSONB,
  "unitNetKurus" INTEGER,
  "unitVatKurus" INTEGER,
  "unitGrossKurus" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalProcurementOrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalProcurementOrderItem_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "ExternalProcurementOrder_provider_workshopId_idempotencyKey_key" ON "ExternalProcurementOrder"("provider", "workshopId", "idempotencyKey");
CREATE UNIQUE INDEX "ExternalProcurementOrder_provider_externalOrderId_key" ON "ExternalProcurementOrder"("provider", "externalOrderId");
CREATE INDEX "ExternalProcurementOrder_workshopId_serviceOrderId_idx" ON "ExternalProcurementOrder"("workshopId", "serviceOrderId");
CREATE INDEX "ExternalProcurementOrder_provider_partnerStatus_updatedAt_idx" ON "ExternalProcurementOrder"("provider", "partnerStatus", "updatedAt");
CREATE UNIQUE INDEX "ExternalProcurementOrderItem_serviceOrderItemId_key" ON "ExternalProcurementOrderItem"("serviceOrderItemId");
CREATE INDEX "ExternalProcurementOrderItem_externalProcurementOrderId_idx" ON "ExternalProcurementOrderItem"("externalProcurementOrderId");

ALTER TABLE "ExternalProcurementOrder" ADD CONSTRAINT "ExternalProcurementOrder_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalProcurementOrder" ADD CONSTRAINT "ExternalProcurementOrder_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalProcurementOrderItem" ADD CONSTRAINT "ExternalProcurementOrderItem_externalProcurementOrderId_fkey" FOREIGN KEY ("externalProcurementOrderId") REFERENCES "ExternalProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalProcurementOrderItem" ADD CONSTRAINT "ExternalProcurementOrderItem_serviceOrderItemId_fkey" FOREIGN KEY ("serviceOrderItemId") REFERENCES "ServiceOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
