-- CreateTable
CREATE TABLE "WorkshopFeatureOverride" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopFeatureOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetWorkshopId" TEXT NOT NULL,
    "reason" TEXT,
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopFeatureOverride_workshopId_idx" ON "WorkshopFeatureOverride"("workshopId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopFeatureOverride_workshopId_featureKey_key" ON "WorkshopFeatureOverride"("workshopId", "featureKey");

-- CreateIndex
CREATE INDEX "ImpersonationSession_adminUserId_idx" ON "ImpersonationSession"("adminUserId");

-- CreateIndex
CREATE INDEX "ImpersonationSession_targetWorkshopId_idx" ON "ImpersonationSession"("targetWorkshopId");

-- CreateIndex
CREATE INDEX "ImpersonationSession_expiresAt_idx" ON "ImpersonationSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "WorkshopFeatureOverride" ADD CONSTRAINT "WorkshopFeatureOverride_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
