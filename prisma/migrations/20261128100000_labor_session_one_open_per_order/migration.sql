-- #1062: bir iş emrinde en fazla bir açık (endTime NULL) işçilik oturumu.
-- Kısmi benzersiz dizin Prisma şemasında ifade edilemez; ham SQL bilinçlidir.
CREATE UNIQUE INDEX "LaborSession_one_open_per_order"
  ON "LaborSession" ("serviceOrderId")
  WHERE "endTime" IS NULL;
