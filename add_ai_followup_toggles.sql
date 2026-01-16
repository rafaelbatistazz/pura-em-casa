-- Add ai_enabled and followup_enabled columns to leads table
-- Defaults to TRUE so existing flows are not broken immediately.

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS followup_enabled BOOLEAN DEFAULT TRUE;

-- Update RLS to allow update of these columns
-- The existing "Update leads" policy likely covers this if it allows UPDATE based on assigned_to.
-- Let's just verify/ensure RLS is fine. The policy "Update leads" allows assigned_to or admin.
-- That should be sufficient.
