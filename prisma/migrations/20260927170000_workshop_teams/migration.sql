-- Workshop-defined teams. Permissions are Permission keys from src/lib/roles.ts.
-- Existing users keep User.role until a team is assigned; the app seeds defaults
-- on the members/teams settings pages.

CREATE TABLE "WorkshopTeam" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkshopTeam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopTeam_workshopId_name_key" ON "WorkshopTeam"("workshopId", "name");
CREATE INDEX "WorkshopTeam_workshopId_idx" ON "WorkshopTeam"("workshopId");

ALTER TABLE "WorkshopTeam"
ADD CONSTRAINT "WorkshopTeam_workshopId_fkey"
FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "teamId" TEXT;

CREATE INDEX "User_teamId_idx" ON "User"("teamId");

ALTER TABLE "User"
ADD CONSTRAINT "User_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "WorkshopTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
