-- Sales advisor panel: global BakımX sales data, deliberately separate from tenant roles.
CREATE TYPE "SalesLeadSource" AS ENUM ('field', 'public_demo_request');
CREATE TYPE "SalesLeadStatus" AS ENUM ('new', 'contacted', 'demo_scheduled', 'demo_completed', 'proposal', 'won', 'lost');
CREATE TYPE "SalesActivityType" AS ENUM ('visit', 'phone', 'whatsapp', 'email', 'demo', 'note');
CREATE TYPE "SalesCommissionStatus" AS ENUM ('draft', 'approved', 'paid', 'void');

CREATE TABLE "SalesAdvisor" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesAdvisor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesAdvisor_userId_key" ON "SalesAdvisor"("userId");
CREATE INDEX "SalesAdvisor_disabledAt_idx" ON "SalesAdvisor"("disabledAt");
ALTER TABLE "SalesAdvisor" ADD CONSTRAINT "SalesAdvisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SalesLead" (
  "id" TEXT NOT NULL,
  "source" "SalesLeadSource" NOT NULL DEFAULT 'field',
  "status" "SalesLeadStatus" NOT NULL DEFAULT 'new',
  "businessName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "city" TEXT,
  "district" TEXT,
  "address" TEXT,
  "monthlyVehicles" TEXT,
  "notes" TEXT,
  "nextActionAt" TIMESTAMP(3),
  "lostReason" TEXT,
  "advisorId" TEXT,
  "workshopId" TEXT,
  "demoRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesLead_workshopId_key" ON "SalesLead"("workshopId");
CREATE UNIQUE INDEX "SalesLead_demoRequestId_key" ON "SalesLead"("demoRequestId");
CREATE INDEX "SalesLead_advisorId_status_idx" ON "SalesLead"("advisorId", "status");
CREATE INDEX "SalesLead_status_nextActionAt_idx" ON "SalesLead"("status", "nextActionAt");
CREATE INDEX "SalesLead_createdAt_idx" ON "SalesLead"("createdAt");
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "SalesAdvisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_demoRequestId_fkey" FOREIGN KEY ("demoRequestId") REFERENCES "DemoRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the existing public-demo queue when it joins the common sales pool.
INSERT INTO "SalesLead" ("id", "source", "status", "businessName", "contactName", "phone", "city", "monthlyVehicles", "notes", "demoRequestId", "createdAt", "updatedAt")
SELECT
  'legacy-demo-' || "id",
  'public_demo_request'::"SalesLeadSource",
  CASE "status"
    WHEN 'contacted' THEN 'contacted'::"SalesLeadStatus"
    WHEN 'qualified' THEN 'proposal'::"SalesLeadStatus"
    WHEN 'converted' THEN 'won'::"SalesLeadStatus"
    WHEN 'archived' THEN 'lost'::"SalesLeadStatus"
    ELSE 'new'::"SalesLeadStatus"
  END,
  "businessName", "name", "phone", "city", "monthlyVehicles", "notes", "id", "createdAt", "updatedAt"
FROM "DemoRequest"
ON CONFLICT ("demoRequestId") DO NOTHING;

CREATE TABLE "SalesActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" "SalesActivityType" NOT NULL,
  "summary" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextActionAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesActivity_leadId_occurredAt_idx" ON "SalesActivity"("leadId", "occurredAt");
ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SalesDemoSession" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesDemoSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesDemoSession_workshopId_key" ON "SalesDemoSession"("workshopId");
CREATE UNIQUE INDEX "SalesDemoSession_tokenHash_key" ON "SalesDemoSession"("tokenHash");
CREATE INDEX "SalesDemoSession_advisorId_expiresAt_idx" ON "SalesDemoSession"("advisorId", "expiresAt");
CREATE INDEX "SalesDemoSession_expiresAt_idx" ON "SalesDemoSession"("expiresAt");
ALTER TABLE "SalesDemoSession" ADD CONSTRAINT "SalesDemoSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesDemoSession" ADD CONSTRAINT "SalesDemoSession_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "SalesAdvisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesDemoSession" ADD CONSTRAINT "SalesDemoSession_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesDemoSession" ADD CONSTRAINT "SalesDemoSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SalesCommission" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "billingOrderId" TEXT NOT NULL,
  "status" "SalesCommissionStatus" NOT NULL DEFAULT 'draft',
  "amountMinor" INTEGER,
  "note" TEXT,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesCommission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesCommission_billingOrderId_key" ON "SalesCommission"("billingOrderId");
CREATE INDEX "SalesCommission_advisorId_status_idx" ON "SalesCommission"("advisorId", "status");
CREATE INDEX "SalesCommission_leadId_idx" ON "SalesCommission"("leadId");
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "SalesAdvisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesCommission" ADD CONSTRAINT "SalesCommission_billingOrderId_fkey" FOREIGN KEY ("billingOrderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
