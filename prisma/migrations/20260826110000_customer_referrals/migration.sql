-- Customer referral pipeline for the platform sales console.
ALTER TYPE "SalesLeadSource" ADD VALUE 'customer_referral';
CREATE TYPE "SalesReferralStatus" AS ENUM ('new', 'contacted', 'won', 'lost');

CREATE TABLE "SalesReferral" (
  "id" TEXT NOT NULL,
  "status" "SalesReferralStatus" NOT NULL DEFAULT 'new',
  "referrerName" TEXT NOT NULL,
  "referrerPhone" TEXT NOT NULL,
  "referredBusinessName" TEXT NOT NULL,
  "referredContactName" TEXT NOT NULL,
  "referredPhone" TEXT NOT NULL,
  "referredEmail" TEXT,
  "notes" TEXT,
  "advisorId" TEXT,
  "leadId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesReferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesReferral_leadId_key" ON "SalesReferral"("leadId");
CREATE INDEX "SalesReferral_advisorId_status_idx" ON "SalesReferral"("advisorId", "status");
CREATE INDEX "SalesReferral_createdAt_idx" ON "SalesReferral"("createdAt");
ALTER TABLE "SalesReferral" ADD CONSTRAINT "SalesReferral_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "SalesAdvisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesReferral" ADD CONSTRAINT "SalesReferral_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
