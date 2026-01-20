-- Create Provider Enum
CREATE TYPE instance_provider AS ENUM ('evolution', 'meta');

-- Modify instances table to support Meta
ALTER TABLE instances 
ADD COLUMN provider instance_provider DEFAULT 'evolution',
ADD COLUMN meta_business_id text,
ADD COLUMN meta_phone_id text,
ADD COLUMN meta_access_token text;

-- Create Templates Table for Meta
CREATE TABLE whatsapp_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    meta_id text NOT NULL, -- The ID from Meta (e.g. '123456789')
    name text NOT NULL,
    status text NOT NULL, -- approved, rejected, pending
    language text DEFAULT 'pt_BR',
    category text, -- MARKETING, UTILITY, AUTHENTICATION
    components jsonb, -- Store the header/body/footer structure
    last_synced_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (admins/staff needs to see templates)
CREATE POLICY "Allow read access for authenticated users" ON whatsapp_templates
FOR SELECT TO authenticated USING (true);

-- Allow full access to admins/service_role
CREATE POLICY "Allow all access for admins" ON whatsapp_templates
FOR ALL TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin' OR has_role(auth.uid(), 'admin'));
