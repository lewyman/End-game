-- Messages table for Educator chat history
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own messages
CREATE POLICY "Users can read own messages" ON messages
  FOR SELECT USING (true);

-- Allow insert for authenticated users
CREATE POLICY "Users can insert messages" ON messages
  FOR INSERT WITH CHECK (true);
