-- Normalize lead contact identity for indexed duplicate detection. Matches the
-- application normalizePhone contract: strip punctuation, then +90/90 or the
-- national leading zero when a country/national prefix is present.
ALTER TABLE "SalesLead"
ADD COLUMN "normalizedPhone" TEXT,
ADD COLUMN "normalizedEmail" TEXT,
ADD COLUMN "attributionFrozenAt" TIMESTAMP(3);

WITH normalized AS (
  SELECT
    "id",
    regexp_replace("phone", '[^0-9]', '', 'g') AS digits
  FROM "SalesLead"
)
UPDATE "SalesLead" AS lead
SET "normalizedPhone" = NULLIF(
  CASE
    WHEN normalized.digits LIKE '90%' AND length(normalized.digits) > 10 THEN substring(normalized.digits FROM 3)
    WHEN normalized.digits LIKE '0%' AND length(normalized.digits) > 10 THEN substring(normalized.digits FROM 2)
    ELSE normalized.digits
  END,
  ''
)
FROM normalized
WHERE normalized."id" = lead."id";

UPDATE "SalesLead"
SET "normalizedEmail" = NULLIF(lower(trim("email")), '')
WHERE "email" IS NOT NULL;

-- Existing won leads already have frozen attribution. Their precise historical
-- win moment was not stored, so updatedAt is the safest non-fabricated boundary.
UPDATE "SalesLead"
SET "attributionFrozenAt" = "updatedAt"
WHERE "status" = 'won';

CREATE INDEX "SalesLead_normalizedPhone_idx" ON "SalesLead"("normalizedPhone");
CREATE INDEX "SalesLead_normalizedEmail_idx" ON "SalesLead"("normalizedEmail");

CREATE TYPE "SalesActivityResult" AS ENUM (
  'reached',
  'no_answer',
  'follow_up_required',
  'demo_scheduled',
  'proposal_sent',
  'won',
  'lost'
);

ALTER TABLE "SalesActivity"
ADD COLUMN "result" "SalesActivityResult",
ADD COLUMN "lostReason" TEXT;

CREATE INDEX "SalesActivity_result_occurredAt_idx" ON "SalesActivity"("result", "occurredAt");

CREATE TABLE "SalesLeadAssignment" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "fromAdvisorId" TEXT,
  "toAdvisorId" TEXT,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalesLeadAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesLeadAssignment_leadId_createdAt_idx" ON "SalesLeadAssignment"("leadId", "createdAt");
CREATE INDEX "SalesLeadAssignment_fromAdvisorId_idx" ON "SalesLeadAssignment"("fromAdvisorId");
CREATE INDEX "SalesLeadAssignment_toAdvisorId_idx" ON "SalesLeadAssignment"("toAdvisorId");
CREATE INDEX "SalesLeadAssignment_actorId_idx" ON "SalesLeadAssignment"("actorId");

ALTER TABLE "SalesLeadAssignment"
ADD CONSTRAINT "SalesLeadAssignment_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesLeadAssignment"
ADD CONSTRAINT "SalesLeadAssignment_fromAdvisorId_fkey"
FOREIGN KEY ("fromAdvisorId") REFERENCES "SalesAdvisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesLeadAssignment"
ADD CONSTRAINT "SalesLeadAssignment_toAdvisorId_fkey"
FOREIGN KEY ("toAdvisorId") REFERENCES "SalesAdvisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesLeadAssignment"
ADD CONSTRAINT "SalesLeadAssignment_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "SalesTaskType" AS ENUM ('call', 'visit', 'online_demo', 'follow_up');
CREATE TYPE "SalesTaskStatus" AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

CREATE TABLE "SalesTask" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" "SalesTaskType" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "status" "SalesTaskStatus" NOT NULL DEFAULT 'scheduled',
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "completedByActivityId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesTask_durationMinutes_check" CHECK ("durationMinutes" BETWEEN 5 AND 480)
);

CREATE UNIQUE INDEX "SalesTask_completedByActivityId_key" ON "SalesTask"("completedByActivityId");
CREATE INDEX "SalesTask_leadId_status_startsAt_idx" ON "SalesTask"("leadId", "status", "startsAt");
CREATE INDEX "SalesTask_status_startsAt_idx" ON "SalesTask"("status", "startsAt");
CREATE INDEX "SalesTask_createdById_idx" ON "SalesTask"("createdById");

ALTER TABLE "SalesTask"
ADD CONSTRAINT "SalesTask_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesTask"
ADD CONSTRAINT "SalesTask_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesTask"
ADD CONSTRAINT "SalesTask_completedByActivityId_fkey"
FOREIGN KEY ("completedByActivityId") REFERENCES "SalesActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
