CREATE TYPE "MarketResearchFundingSource" AS ENUM ('platform', 'customer');
CREATE TYPE "MarketResearchUsageStatus" AS ENUM ('running', 'succeeded', 'failed');

CREATE TABLE "market_research_credentials" (
    "id" TEXT NOT NULL,
    "workshop_id" TEXT NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "masked_last_4" TEXT NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "market_research_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_research_usages" (
    "id" TEXT NOT NULL,
    "workshop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month_start" DATE NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "funding_source" "MarketResearchFundingSource" NOT NULL,
    "status" "MarketResearchUsageStatus" NOT NULL DEFAULT 'running',
    "estimated_cost_micro_usd" BIGINT NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_creation_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "web_search_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "market_research_usages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_research_credentials_workshop_id_key" ON "market_research_credentials"("workshop_id");
CREATE INDEX "market_research_usages_workshop_id_month_start_status_idx" ON "market_research_usages"("workshop_id", "month_start", "status");
CREATE INDEX "market_research_usages_created_at_idx" ON "market_research_usages"("created_at");

ALTER TABLE "market_research_credentials" ADD CONSTRAINT "market_research_credentials_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "market_research_usages" ADD CONSTRAINT "market_research_usages_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
