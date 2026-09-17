-- Multi-branch v1: Organization groups Workshops; WorkshopMembership links Users across branches.

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Workshop" ADD COLUMN "organizationId" TEXT;

CREATE TABLE "WorkshopMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkshopMembership_pkey" PRIMARY KEY ("id")
);

-- One Organization per existing Workshop (name = workshop name).
INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt")
SELECT 'org_' || w."id", w."name", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workshop" w
WHERE w."organizationId" IS NULL;

UPDATE "Workshop" w
SET "organizationId" = 'org_' || w."id"
WHERE w."organizationId" IS NULL;

CREATE UNIQUE INDEX "WorkshopMembership_userId_workshopId_key" ON "WorkshopMembership"("userId", "workshopId");
CREATE INDEX "WorkshopMembership_workshopId_idx" ON "WorkshopMembership"("workshopId");
CREATE INDEX "WorkshopMembership_userId_idx" ON "WorkshopMembership"("userId");
CREATE INDEX "Workshop_organizationId_idx" ON "Workshop"("organizationId");

-- Mirror every existing User seat into WorkshopMembership.
INSERT INTO "WorkshopMembership" ("id", "userId", "workshopId", "role", "isActive", "createdAt", "updatedAt")
SELECT 'wm_' || u."id", u."id", u."workshopId", u."role", u."isActive", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("userId", "workshopId") DO NOTHING;

ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkshopMembership" ADD CONSTRAINT "WorkshopMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkshopMembership" ADD CONSTRAINT "WorkshopMembership_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
