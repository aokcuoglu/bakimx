-- Satış adayı kayıt sihirbazına geçtiğinde hunide ayrı bir aşamada izlenir.
ALTER TYPE "SalesLeadStatus" ADD VALUE IF NOT EXISTS 'onboarding' BEFORE 'won';

-- Ham token yalnız müşteriye verilen URL'de bulunur. Veritabanında SHA-256
-- özeti, danışman atfı ve tüketim/iptal denetim alanları saklanır.
CREATE TABLE "SalesRegistrationLink" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "workshopId" TEXT,
    "createdById" TEXT NOT NULL,
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRegistrationLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesRegistrationLink_tokenHash_key" ON "SalesRegistrationLink"("tokenHash");
CREATE UNIQUE INDEX "SalesRegistrationLink_workshopId_key" ON "SalesRegistrationLink"("workshopId");
CREATE INDEX "SalesRegistrationLink_leadId_createdAt_idx" ON "SalesRegistrationLink"("leadId", "createdAt");
CREATE INDEX "SalesRegistrationLink_advisorId_createdAt_idx" ON "SalesRegistrationLink"("advisorId", "createdAt");
CREATE INDEX "SalesRegistrationLink_expiresAt_idx" ON "SalesRegistrationLink"("expiresAt");
CREATE INDEX "SalesRegistrationLink_createdById_idx" ON "SalesRegistrationLink"("createdById");
CREATE INDEX "SalesRegistrationLink_revokedById_idx" ON "SalesRegistrationLink"("revokedById");

-- Aynı lead için iki eşzamanlı üretim yalnız bir aktif bağlantı bırakabilir.
-- Süresi dolan kayıt yeni üretimde önce revokedAt ile kapatılır.
CREATE UNIQUE INDEX "SalesRegistrationLink_one_active_per_lead"
    ON "SalesRegistrationLink"("leadId")
    WHERE "usedAt" IS NULL AND "revokedAt" IS NULL;

ALTER TABLE "SalesRegistrationLink"
    ADD CONSTRAINT "SalesRegistrationLink_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesRegistrationLink"
    ADD CONSTRAINT "SalesRegistrationLink_advisorId_fkey"
    FOREIGN KEY ("advisorId") REFERENCES "SalesAdvisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesRegistrationLink"
    ADD CONSTRAINT "SalesRegistrationLink_workshopId_fkey"
    FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesRegistrationLink"
    ADD CONSTRAINT "SalesRegistrationLink_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesRegistrationLink"
    ADD CONSTRAINT "SalesRegistrationLink_revokedById_fkey"
    FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
