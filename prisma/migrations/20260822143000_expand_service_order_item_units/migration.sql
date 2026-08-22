-- Keep stock-linked and count/package units integral while allowing fractional
-- quantities for fluids, weights, and lengths used by automotive workshops.
ALTER TABLE "ServiceOrderItem"
  DROP CONSTRAINT "ServiceOrderItem_quantity_check";

ALTER TABLE "ServiceOrderItem"
  ADD CONSTRAINT "ServiceOrderItem_quantity_check"
  CHECK (
    "quantity" > 0
    AND "quantity" <= 999
    AND (
      "quantity" = trunc("quantity")
      OR (
        "unit" IN ('litre', 'mililitre', 'kilogram', 'gram', 'metre', 'santimetre')
        AND "partId" IS NULL
      )
    )
  );
