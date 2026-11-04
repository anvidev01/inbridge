-- 008_tavily_usage.sql
-- One row per Tavily search call made by the chat plane. The user's query text
-- is deliberately NOT stored (citizen queries can contain personal details).
CREATE TABLE IF NOT EXISTS tavily_usage (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    credits NUMERIC(10,2) NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    search_depth VARCHAR(20),
    result_count INTEGER NOT NULL DEFAULT 0,
    error_kind VARCHAR(20),
    request_id VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_tavily_usage_created_at ON tavily_usage(created_at DESC);
