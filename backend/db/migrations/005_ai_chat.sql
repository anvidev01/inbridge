-- Step 1: Create Conversations table
CREATE TABLE conversations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id    UUID NOT NULL, -- references citizens(id) once auth is fixed, omitting FK for standalone demo ease
    title         TEXT,
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Create Messages table
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    tokens_used     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Step 5: Create Indexes for Performance
CREATE INDEX idx_conversations_citizen ON conversations(citizen_id, updated_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
