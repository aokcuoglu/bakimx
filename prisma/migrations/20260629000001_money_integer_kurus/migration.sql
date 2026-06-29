-- Money/rate columns: Float (double precision) -> Int.
--
-- Money columns become integer KURUŞ (minor units): 1 TRY = 100 kuruş.
-- Rate columns become integer BASIS POINTS (bps): %20 = 2000, %5,5 = 550.
--
-- Both conversions multiply the stored value by 100 (TRY->kuruş; percent->bps,
-- since taxRate/discountRate were stored as the percent value e.g. 20). NULLs are
-- preserved (round(NULL * 100) = NULL). round() applies half-away-from-zero, the
-- same policy as src/lib/money.ts, so the application and the backfill agree.
--
-- Prisma does NOT generate a USING clause for a narrowing Float->Int change, so
-- every ALTER below was edited in by hand after `prisma migrate dev --create-only`.
--
-- ----------------------------------------------------------------------------
-- BACKFILL VERIFICATION (run on staging BEFORE and AFTER; sums must match):
--   -- before (Float lira):           after (Int kuruş / 100):
--   SELECT SUM("discountAmount")              FROM "ServiceOrder";
--   SELECT SUM("discountAmount")    / 100.0   FROM "ServiceOrder";
--   SELECT SUM("paidAmount")                  FROM "ServiceOrder";
--   SELECT SUM("paidAmount")        / 100.0   FROM "ServiceOrder";
--   SELECT SUM("remainingAmount")             FROM "ServiceOrder";
--   SELECT SUM("remainingAmount")   / 100.0   FROM "ServiceOrder";
--   SELECT SUM("amount")                      FROM "CollectionPayment";
--   SELECT SUM("amount")            / 100.0   FROM "CollectionPayment";
--   SELECT SUM("unitPrice"), SUM("totalPrice")            FROM "ServiceOrderItem";
--   SELECT SUM("unitPrice")/100.0, SUM("totalPrice")/100.0 FROM "ServiceOrderItem";
--   SELECT SUM("estimatedLaborTotal"), SUM("estimatedPartsTotal"),
--          SUM("discountAmount"), SUM("grandTotal")        FROM "Quote";
--   SELECT SUM("estimatedLaborTotal")/100.0, SUM("estimatedPartsTotal")/100.0,
--          SUM("discountAmount")/100.0, SUM("grandTotal")/100.0 FROM "Quote";
--   SELECT SUM("unitPrice"), SUM("totalPrice")            FROM "QuoteItem";
--   SELECT SUM("unitPrice")/100.0, SUM("totalPrice")/100.0 FROM "QuoteItem";
--   SELECT SUM("purchasePrice"), SUM("salePrice")            FROM "PartStockItem";
--   SELECT SUM("purchasePrice")/100.0, SUM("salePrice")/100.0 FROM "PartStockItem";
--   -- rates:
--   SELECT AVG("taxRate") FROM "ServiceOrder";  -- ~20 before -> ~2000 after (÷100 matches)
--   SELECT AVG("taxRate") FROM "Quote";
--   SELECT AVG("discountRate") FROM "Customer";
--
-- ROLLBACK (reverse migration, if ever needed):
--   ALTER TABLE "<T>" ALTER COLUMN "<col>" TYPE double precision USING ("<col>"::double precision / 100);
--   (apply to every column below; restores lira/percent floats.)
-- ----------------------------------------------------------------------------

-- Customer.discountRate: percent -> bps
ALTER TABLE "Customer" ALTER COLUMN "discountRate" TYPE INTEGER USING round("discountRate" * 100);
ALTER TABLE "Customer" ALTER COLUMN "discountRate" SET DEFAULT 0;

-- ServiceOrder: money (kuruş) + taxRate (bps)
ALTER TABLE "ServiceOrder" ALTER COLUMN "discountAmount"  TYPE INTEGER USING round("discountAmount" * 100);
ALTER TABLE "ServiceOrder" ALTER COLUMN "taxRate"         TYPE INTEGER USING round("taxRate" * 100);
ALTER TABLE "ServiceOrder" ALTER COLUMN "paidAmount"      TYPE INTEGER USING round("paidAmount" * 100);
ALTER TABLE "ServiceOrder" ALTER COLUMN "remainingAmount" TYPE INTEGER USING round("remainingAmount" * 100);

-- CollectionPayment.amount: money (kuruş), NOT NULL preserved
ALTER TABLE "CollectionPayment" ALTER COLUMN "amount" TYPE INTEGER USING round("amount" * 100);

-- ServiceOrderItem: money (kuruş)
ALTER TABLE "ServiceOrderItem" ALTER COLUMN "unitPrice"  TYPE INTEGER USING round("unitPrice" * 100);
ALTER TABLE "ServiceOrderItem" ALTER COLUMN "totalPrice" TYPE INTEGER USING round("totalPrice" * 100);

-- Quote: money (kuruş) + taxRate (bps)
ALTER TABLE "Quote" ALTER COLUMN "estimatedLaborTotal" TYPE INTEGER USING round("estimatedLaborTotal" * 100);
ALTER TABLE "Quote" ALTER COLUMN "estimatedPartsTotal" TYPE INTEGER USING round("estimatedPartsTotal" * 100);
ALTER TABLE "Quote" ALTER COLUMN "discountAmount"      TYPE INTEGER USING round("discountAmount" * 100);
ALTER TABLE "Quote" ALTER COLUMN "taxRate"             TYPE INTEGER USING round("taxRate" * 100);
ALTER TABLE "Quote" ALTER COLUMN "grandTotal"          TYPE INTEGER USING round("grandTotal" * 100);

-- QuoteItem: money (kuruş)
ALTER TABLE "QuoteItem" ALTER COLUMN "unitPrice"  TYPE INTEGER USING round("unitPrice" * 100);
ALTER TABLE "QuoteItem" ALTER COLUMN "totalPrice" TYPE INTEGER USING round("totalPrice" * 100);

-- PartStockItem: money (kuruş)
ALTER TABLE "PartStockItem" ALTER COLUMN "purchasePrice" TYPE INTEGER USING round("purchasePrice" * 100);
ALTER TABLE "PartStockItem" ALTER COLUMN "salePrice"     TYPE INTEGER USING round("salePrice" * 100);
