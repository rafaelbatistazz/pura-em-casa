-- Add media_type column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT NULL;

-- Create chat-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- RLS policy for anyone to view
CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'chat-media');