ALTER TABLE "VehicleIntakeForm" ADD COLUMN "bodyType" TEXT NOT NULL DEFAULT 'sedan', ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "inspectionStatus" TEXT NOT NULL DEFAULT 'not_recorded', ADD COLUMN "inspectedById" TEXT, ADD COLUMN "inspectedAt" TIMESTAMP(3), ADD COLUMN "nextDamageNumber" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DamageMark" ADD COLUMN "number" INTEGER, ADD COLUMN "requestId" TEXT, ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
WITH numbered AS (SELECT "id", row_number() OVER (PARTITION BY "intakeFormId" ORDER BY "createdAt", "id") AS n FROM "DamageMark") UPDATE "DamageMark" d SET "number" = n.n FROM numbered n WHERE d."id" = n."id";
ALTER TABLE "DamageMark" ALTER COLUMN "number" SET NOT NULL;
UPDATE "VehicleIntakeForm" i SET "nextDamageNumber" = d.n FROM (SELECT "intakeFormId", MAX("number") AS n FROM "DamageMark" GROUP BY "intakeFormId") d WHERE i."id" = d."intakeFormId";
CREATE UNIQUE INDEX "DamageMark_intakeFormId_number_key" ON "DamageMark"("intakeFormId", "number");
CREATE UNIQUE INDEX "DamageMark_intakeFormId_requestId_key" ON "DamageMark"("intakeFormId", "requestId");
CREATE INDEX "DamageMark_deletedAt_idx" ON "DamageMark"("deletedAt");
ALTER TABLE "VehiclePhoto" ADD COLUMN "requestId" TEXT;
CREATE UNIQUE INDEX "VehiclePhoto_intakeFormId_requestId_key" ON "VehiclePhoto"("intakeFormId", "requestId");
CREATE TABLE "DamagePhoto" ("damageMarkId" TEXT NOT NULL REFERENCES "DamageMark"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "photoId" TEXT NOT NULL REFERENCES "VehiclePhoto"("id") ON DELETE RESTRICT ON UPDATE CASCADE, PRIMARY KEY ("damageMarkId", "photoId"));
CREATE INDEX "DamagePhoto_photoId_idx" ON "DamagePhoto"("photoId");
CREATE TABLE "PhotoAnnotationVersion" ("id" TEXT PRIMARY KEY, "photoId" TEXT NOT NULL REFERENCES "VehiclePhoto"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "version" INTEGER NOT NULL, "requestId" TEXT NOT NULL, "document" JSONB NOT NULL, "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg', "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "PhotoAnnotationVersion_photoId_version_key" ON "PhotoAnnotationVersion"("photoId", "version");
CREATE UNIQUE INDEX "PhotoAnnotationVersion_photoId_requestId_key" ON "PhotoAnnotationVersion"("photoId", "requestId");
-- Suggest the same body for existing intakes as for newly created intakes.
UPDATE "VehicleIntakeForm" i SET "bodyType" = CASE WHEN v."vehicleType" = 'hafif_ticari' THEN 'van' WHEN v."vehicleType" IN ('agir_vasita', 'motosiklet', 'diger') THEN 'unsupported' ELSE 'sedan' END FROM "Vehicle" v WHERE i."vehicleId" = v."id";
ALTER TABLE "DamageMark" ALTER COLUMN "updatedAt" DROP DEFAULT;
