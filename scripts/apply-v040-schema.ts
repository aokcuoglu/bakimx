import { Pool } from "pg"

const pool = new Pool({
  connectionString:
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    "",
})

async function main() {
  const client = await pool.connect()
  try {
    console.log("Applying v0.4.0 schema patches...")

    // Add missing columns to ServiceOrder
    await client.query(`
      ALTER TABLE "ServiceOrder"
      ADD COLUMN IF NOT EXISTS "assignedTechnicianId" TEXT,
      ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
    `)
    console.log("✅ ServiceOrder columns added")

    // Add missing columns to VehiclePhoto
    await client.query(`
      ALTER TABLE "VehiclePhoto"
      ADD COLUMN IF NOT EXISTS "serviceOrderId" TEXT,
      ADD COLUMN IF NOT EXISTS "phase" TEXT NOT NULL DEFAULT 'intake';
    `)
    console.log("✅ VehiclePhoto columns added")

    // Create Technician
    await client.query(`
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
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "Technician_workshopId_idx" ON "Technician"("workshopId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "Technician_workshopId_isActive_idx" ON "Technician"("workshopId", "isActive");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "Technician_workshopId_role_idx" ON "Technician"("workshopId", "role");`)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Technician_workshopId_fkey') THEN
          ALTER TABLE "Technician" ADD CONSTRAINT "Technician_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    console.log("✅ Technician table ready")

    // Create ChecklistItem
    await client.query(`
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
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "ChecklistItem_workshopId_idx" ON "ChecklistItem"("workshopId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "ChecklistItem_serviceOrderId_idx" ON "ChecklistItem"("serviceOrderId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "ChecklistItem_category_idx" ON "ChecklistItem"("category");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "ChecklistItem_isCompleted_idx" ON "ChecklistItem"("isCompleted");`)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistItem_workshopId_fkey') THEN
          ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistItem_serviceOrderId_fkey') THEN
          ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistItem_completedById_fkey') THEN
          ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    console.log("✅ ChecklistItem table ready")

    // Create InternalNote
    await client.query(`
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
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "InternalNote_workshopId_idx" ON "InternalNote"("workshopId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "InternalNote_serviceOrderId_idx" ON "InternalNote"("serviceOrderId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "InternalNote_authorId_idx" ON "InternalNote"("authorId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "InternalNote_createdAt_idx" ON "InternalNote"("createdAt");`)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalNote_workshopId_fkey') THEN
          ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalNote_serviceOrderId_fkey') THEN
          ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalNote_authorId_fkey') THEN
          ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    console.log("✅ InternalNote table ready")

    // Create PartsRequest
    await client.query(`
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
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "PartsRequest_workshopId_idx" ON "PartsRequest"("workshopId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "PartsRequest_serviceOrderId_idx" ON "PartsRequest"("serviceOrderId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "PartsRequest_status_idx" ON "PartsRequest"("status");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "PartsRequest_requestedById_idx" ON "PartsRequest"("requestedById");`)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartsRequest_workshopId_fkey') THEN
          ALTER TABLE "PartsRequest" ADD CONSTRAINT "PartsRequest_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartsRequest_serviceOrderId_fkey') THEN
          ALTER TABLE "PartsRequest" ADD CONSTRAINT "PartsRequest_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartsRequest_requestedById_fkey') THEN
          ALTER TABLE "PartsRequest" ADD CONSTRAINT "PartsRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    console.log("✅ PartsRequest table ready")

    // Create LaborSession
    await client.query(`
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
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "LaborSession_workshopId_idx" ON "LaborSession"("workshopId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "LaborSession_serviceOrderId_idx" ON "LaborSession"("serviceOrderId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "LaborSession_technicianId_idx" ON "LaborSession"("technicianId");`)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LaborSession_workshopId_fkey') THEN
          ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LaborSession_serviceOrderId_fkey') THEN
          ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LaborSession_technicianId_fkey') THEN
          ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `)
    console.log("✅ LaborSession table ready")

    // Add FK from ServiceOrder to Technician
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceOrder_assignedTechnicianId_fkey') THEN
          ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `)

    // Add FK from VehiclePhoto to ServiceOrder
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VehiclePhoto_serviceOrderId_fkey') THEN
          ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `)

    // Add missing indexes on ServiceOrder
    await client.query(`CREATE INDEX IF NOT EXISTS "ServiceOrder_assignedTechnicianId_idx" ON "ServiceOrder"("assignedTechnicianId");`)
    await client.query(`CREATE INDEX IF NOT EXISTS "ServiceOrder_workshopId_assignedTechnicianId_idx" ON "ServiceOrder"("workshopId", "assignedTechnicianId");`)

    console.log("✅ All v0.4.0 schema patches applied successfully!")
  } catch (err) {
    console.error("Migration failed:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
