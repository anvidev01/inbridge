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

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Step 4: Create Policies
-- Note: In a real Supabase app using Supabase Auth, we would use auth.uid()
-- For this demo where citizen_id is passed from the Next.js backend manually, we allow all for now
-- Or if we were using a custom JWT middleware, we would bypass RLS from the server side.
CREATE POLICY "Allow service role full access to conversations" 
ON conversations FOR ALL USING (true);

CREATE POLICY "Allow service role full access to messages" 
ON messages FOR ALL USING (true);

-- Step 5: Create Indexes for Performance
CREATE INDEX idx_conversations_citizen ON conversations(citizen_id, updated_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
