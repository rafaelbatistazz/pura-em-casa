-- Add whatsapp_id to messages table for better deduplication
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS whatsapp_id TEXT;

-- Add unique constraint to prevent duplicates from webhook retries
-- We use a partial index if we only care about inbound or if we want global uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON public.messages(whatsapp_id) WHERE whatsapp_id IS NOT NULL;

-- Update RLS if needed (already managed by table-level RLS usually)
