-- ADD SOURCE COLUMN TO LEADS
-- Adds a 'source' text column to track lead origin (e.g. Facebook, Instagram, Organic)

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS source text;

-- Optional: Update RLS policies (usually not needed if using standard "all columns" policies, 
-- but ensuring 'update' policy covers it is good practice, which our previous scripts did via ALL or simple filters).
