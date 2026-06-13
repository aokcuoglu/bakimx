-- Add missing columns to ServiceOrder
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "assignedTechnicianId" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Add missing columns to VehiclePhoto
ALTER TABLE "VehiclePhoto" ADD COLUMN IF NOT EXISTS "serviceOrderId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'VehiclePhoto' AND column_name = 'phase'
  ) THEN
    ALTER TABLE "VehiclePhoto" ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'intake';
  END IF;
END $$;

-- Create Technician table
CREATE TABLE IF NOT EXISTS "Technician" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'usta',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Technician_workshopId_idx" ON "Technician"("workshopId");
CREATE INDEX IF NOT EXISTS "Technician_workshopId_isActive_idx" ON "Technician"("workshopId", "isActive");
CREATE INDEX IF NOT EXISTS "Technician_workshopId_role_idx" ON "Technician"("workshopId", "role");
ALTER TABLE "Technician" DROP CONSTRAINT IF EXISTS "Technician_workshopId_fkey";
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create ChecklistItem table
CREATE TABLE IF NOT EXISTS "ChecklistItem" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'inspection',
    "description" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChecklistItem_workshopId_idx" ON "ChecklistItem"("workshopId");
CREATE INDEX IF NOT EXISTS "ChecklistItem_serviceOrderId_idx" ON "ChecklistItem"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "ChecklistItem_category_idx" ON "ChecklistItem"("category");
CREATE INDEX IF NOT EXISTS "ChecklistItem_isCompleted_idx" ON "ChecklistItem"("isCompleted");
ALTER TABLE "ChecklistItem" DROP CONSTRAINT IF EXISTS "ChecklistItem_workshopId_fkey";
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChecklistItem" DROP CONSTRAINT IF EXISTS "ChecklistItem_serviceOrderId_fkey";
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChecklistItem" DROP CONSTRAINT IF EXISTS "ChecklistItem_completedById_fkey";
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create InternalNote table
CREATE TABLE IF NOT EXISTS "InternalNote" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InternalNote_workshopId_idx" ON "InternalNote"("workshopId");
CREATE INDEX IF NOT EXISTS "InternalNote_serviceOrderId_idx" ON "InternalNote"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "InternalNote_authorId_idx" ON "InternalNote"("authorId");
CREATE INDEX IF NOT EXISTS "InternalNote_createdAt_idx" ON "InternalNote"("createdAt");
ALTER TABLE "InternalNote" DROP CONSTRAINT IF EXISTS "InternalNote_workshopId_fkey";
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote" DROP CONSTRAINT IF EXISTS "InternalNote_serviceOrderId_fkey";
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote" DROP CONSTRAINT IF EXISTS "InternalNote_authorId_fkey";
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create PartsRequest table
CREATE TABLE IF NOT EXISTS "PartsRequest" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "requestedById" TEXT,
    "partName" TEXT NOT NULL,
    "partSku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartsRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PartsRequest_workshopId_idx" ON "PartsRequest"("workshopId");
CREATE INDEX IF NOT EXISTS "PartsRequest_serviceOrderId_idx" ON "PartsRequest"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "PartsRequest_status_idx" ON "PartsRequest"("status");
CREATE INDEX IF NOT EXISTS "PartsRequest_requestedById_idx" ON "PartsRequest"("requestedById");
ALTER TABLE "PartsRequest" DROP CONSTRAINT IF EXISTS "PartsRequest_workshopId_fkey";
ALTER TABLE "PartsRequest" ADD CONSTRAINT "PartsRequest_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartsRequest" DROP CONSTRAINT IF EXISTS "PartsRequest_serviceOrderId_fkey";
ALTER TABLE "PartsRequest" ADD CONSTRAINT "PartsRequest_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartsRequest" DROP CONSTRAINT IF EXISTS "PartsRequest_requestedById_fkey";
ALTER TABLE "PartsRequest" ADD CONSTRAINT "PartsRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create LaborSession table
CREATE TABLE IF NOT EXISTS "LaborSession" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "technicianId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LaborSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LaborSession_workshopId_idx" ON "LaborSession"("workshopId");
CREATE INDEX IF NOT EXISTS "LaborSession_serviceOrderId_idx" ON "LaborSession"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "LaborSession_technicianId_idx" ON "LaborSession"("technicianId");
ALTER TABLE "LaborSession" DROP CONSTRAINT IF EXISTS "LaborSession_workshopId_fkey";
ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LaborSession" DROP CONSTRAINT IF EXISTS "LaborSession_serviceOrderId_fkey";
ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LaborSession" DROP CONSTRAINT IF EXISTS "LaborSession_technicianId_fkey";
ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ServiceOrder FK to Technician
ALTER TABLE "ServiceOrder" DROP CONSTRAINT IF EXISTS "ServiceOrder_assignedTechnicianId_fkey";
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- VehiclePhoto FK to ServiceOrder
ALTER TABLE "VehiclePhoto" DROP CONSTRAINT IF EXISTS "VehiclePhoto_serviceOrderId_fkey";
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add missing ServiceOrder indexes
CREATE INDEX IF NOT EXISTS "ServiceOrder_assignedTechnicianId_idx" ON "ServiceOrder"("assignedTechnicianId");
CREATE INDEX IF NOT EXISTS "ServiceOrder_workshopId_assignedTechnicianId_idx" ON "ServiceOrder"("workshopId", "assignedTechnicianId");
