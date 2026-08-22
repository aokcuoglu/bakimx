-- A phone may belong to more than one customer within a workshop.
-- Duplicate numbers still surface a warning in create/update; proceeding is an
-- explicit confirmation (allowDuplicatePhone), not a silent second insert.
--
-- Replaces UNIQUE "Customer_workshopId_phone_key" with the original
-- non-unique lookup index "Customer_workshopId_phone_idx".

DROP INDEX "Customer_workshopId_phone_key";

CREATE INDEX "Customer_workshopId_phone_idx" ON "Customer"("workshopId", "phone");
