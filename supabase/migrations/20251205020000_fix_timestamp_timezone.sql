-- Convert timestamp columns to timestamp with time zone (timestamptz)

-- Messages table
ALTER TABLE public.messages 
ALTER COLUMN timestamp TYPE timestamp with time zone 
USING timestamp AT TIME ZONE 'UTC';

-- Leads table
ALTER TABLE public.leads 
ALTER COLUMN created_at TYPE timestamp with time zone 
USING created_at AT TIME ZONE 'UTC';

ALTER TABLE public.leads 
ALTER COLUMN updated_at TYPE timestamp with time zone 
USING updated_at AT TIME ZONE 'UTC';
