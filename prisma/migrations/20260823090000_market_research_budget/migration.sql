CREATE TABLE "market_research_budgets" (
    "month_start" DATE NOT NULL,
    "spent_micro_usd" BIGINT NOT NULL DEFAULT 0,
    "reserved_micro_usd" BIGINT NOT NULL DEFAULT 0,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "web_search_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "market_research_budgets_pkey" PRIMARY KEY ("month_start")
);
