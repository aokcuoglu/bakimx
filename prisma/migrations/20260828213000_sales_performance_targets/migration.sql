-- Danışman başına Europe/Istanbul takvim ayı hedefleri. Gerçekleşen değerler
-- CRM olayları ve hakediş ledger snapshot'larından hesaplanır; bu tablo yalnız
-- kurucunun belirlediği hedefleri saklar.
CREATE TABLE "SalesAdvisorMonthlyTarget" (
  "id" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "monthStart" TIMESTAMP(3) NOT NULL,
  "newLeadTarget" INTEGER NOT NULL DEFAULT 0,
  "qualifiedInteractionTarget" INTEGER NOT NULL DEFAULT 0,
  "completedDemoTarget" INTEGER NOT NULL DEFAULT 0,
  "wonWorkshopTarget" INTEGER NOT NULL DEFAULT 0,
  "netSalesTargetMinor" INTEGER NOT NULL DEFAULT 0,
  "setById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesAdvisorMonthlyTarget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesAdvisorMonthlyTarget_nonnegative_check" CHECK (
    "newLeadTarget" >= 0
    AND "qualifiedInteractionTarget" >= 0
    AND "completedDemoTarget" >= 0
    AND "wonWorkshopTarget" >= 0
    AND "netSalesTargetMinor" >= 0
  )
);

CREATE UNIQUE INDEX "SalesAdvisorMonthlyTarget_advisorId_monthStart_key"
  ON "SalesAdvisorMonthlyTarget"("advisorId", "monthStart");
CREATE INDEX "SalesAdvisorMonthlyTarget_monthStart_idx"
  ON "SalesAdvisorMonthlyTarget"("monthStart");
CREATE INDEX "SalesAdvisorMonthlyTarget_setById_idx"
  ON "SalesAdvisorMonthlyTarget"("setById");

ALTER TABLE "SalesAdvisorMonthlyTarget"
  ADD CONSTRAINT "SalesAdvisorMonthlyTarget_advisorId_fkey"
  FOREIGN KEY ("advisorId") REFERENCES "SalesAdvisor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SalesAdvisorMonthlyTarget_setById_fkey"
  FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
