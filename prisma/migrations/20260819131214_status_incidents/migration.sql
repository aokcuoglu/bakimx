-- CreateEnum
CREATE TYPE "StatusIncidentSeverity" AS ENUM ('degraded', 'major_outage');

-- CreateTable
CREATE TABLE "status_incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "StatusIncidentSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "created_by_email" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "status_incidents_resolved_at_idx" ON "status_incidents"("resolved_at");

-- CreateIndex
CREATE INDEX "status_incidents_created_at_idx" ON "status_incidents"("created_at");
