-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Ensure RLS is enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read messages (required for Realtime)
CREATE POLICY IF NOT EXISTS "Authenticated users can read messages"
ON messages FOR SELECT
TO authenticated
USING (true);

-- Allow service role to insert messages (for N8N/webhooks)
CREATE POLICY IF NOT EXISTS "Service role can insert messages"
ON messages FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow authenticated users to insert their own outbound messages
CREATE POLICY IF NOT EXISTS "Users can insert outbound messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (direction = 'outbound');

-- Allow authenticated users to update read status
CREATE POLICY IF NOT EXISTS "Users can mark messages as read"
ON messages FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
