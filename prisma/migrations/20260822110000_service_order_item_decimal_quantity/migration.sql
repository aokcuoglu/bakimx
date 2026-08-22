-- Existing integer values convert losslessly. NUMERIC avoids binary floating-point
-- drift while allowing divisible units (for example 1.2 litre).
ALTER TABLE "ServiceOrderItem"
  ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::DECIMAL(12,3),
  ALTER COLUMN "quantity" SET DEFAULT 1;

ALTER TABLE "ServiceOrderItem"
  ADD CONSTRAINT "ServiceOrderItem_quantity_check"
  CHECK (
    "quantity" > 0
    AND "quantity" <= 999
    AND (
      "quantity" = trunc("quantity")
      OR ("unit" = 'litre' AND "partId" IS NULL)
    )
  );
