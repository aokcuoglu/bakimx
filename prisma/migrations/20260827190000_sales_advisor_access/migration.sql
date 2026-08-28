-- Separate customer tenants from BakımX's own internal staff container.
CREATE TYPE "WorkshopKind" AS ENUM ('customer', 'internal');

ALTER TABLE "Workshop"
ADD COLUMN "kind" "WorkshopKind" NOT NULL DEFAULT 'customer';

CREATE INDEX "Workshop_kind_idx" ON "Workshop"("kind");

-- There is exactly one internal staff container. A partial unique index keeps
-- customer rows unconstrained while preventing a second internal workshop.
CREATE UNIQUE INDEX "Workshop_single_internal_kind"
ON "Workshop"("kind")
WHERE "kind" = 'internal';

INSERT INTO "Workshop" (
  "id",
  "kind",
  "loginCode",
  "name",
  "phone",
  "city",
  "address",
  "planTier",
  "subscriptionStatus",
  "approvalStatus",
  "createdAt",
  "updatedAt"
)
SELECT
  'bakimx-internal-operations',
  'internal',
  'bakimx-ic-operasyon',
  'BakımX İç Operasyon',
  '-',
  'İstanbul',
  'BakımX İç Operasyon',
  'pro',
  'active',
  'approved',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Workshop" WHERE "kind" = 'internal'
);

ALTER TABLE "SalesAdvisor"
ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);

CREATE TYPE "SalesAdvisorInviteStatus" AS ENUM ('pending', 'accepted', 'revoked');

CREATE TABLE "SalesAdvisorInvite" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "SalesAdvisorInviteStatus" NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesAdvisorInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesAdvisorInvite_email_key" ON "SalesAdvisorInvite"("email");
CREATE UNIQUE INDEX "SalesAdvisorInvite_tokenHash_key" ON "SalesAdvisorInvite"("tokenHash");
CREATE INDEX "SalesAdvisorInvite_status_expiresAt_idx" ON "SalesAdvisorInvite"("status", "expiresAt");
CREATE INDEX "SalesAdvisorInvite_createdByUserId_idx" ON "SalesAdvisorInvite"("createdByUserId");

ALTER TABLE "SalesAdvisorInvite"
ADD CONSTRAINT "SalesAdvisorInvite_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
