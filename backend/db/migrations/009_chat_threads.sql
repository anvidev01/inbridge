-- 009_chat_threads.sql
-- A signed-in citizen's chat history, so a conversation can be continued on any
-- device. The thread is stored as the browser holds it (messages as JSONB) so
-- cited answers, sources and follow-ups render exactly as they did live.
-- ids and timestamps are client-generated (uuid / epoch ms) to keep the browser's
-- local copy and this one directly comparable.
CREATE TABLE IF NOT EXISTS chat_threads (
    citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    id         VARCHAR(64) NOT NULL,
    title      VARCHAR(200) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    messages   JSONB NOT NULL,
    PRIMARY KEY (citizen_id, id)
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_citizen_updated ON chat_threads(citizen_id, updated_at DESC);

-- Only the backend (a role that bypasses RLS) may touch this table; the public
-- Supabase API gets nothing.
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
