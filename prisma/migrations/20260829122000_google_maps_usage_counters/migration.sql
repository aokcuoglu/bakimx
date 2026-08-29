-- Google Maps billable SKU'ları için fail-closed aylık rezervasyon sayacı.
CREATE TABLE "google_maps_usage_counters" (
    "period" VARCHAR(7) NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "reserved_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_count" INTEGER NOT NULL DEFAULT 0,
    "last_reserved_at" TIMESTAMP(3),
    "last_blocked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_maps_usage_counters_pkey" PRIMARY KEY ("period", "sku")
);

CREATE INDEX "google_maps_usage_counters_period_idx"
ON "google_maps_usage_counters"("period");

