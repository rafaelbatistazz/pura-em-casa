-- FIX: AUTO-DISTRIBUTION TRIGGER
-- This script adds a trigger to automatically distribute leads 
-- if they are inserted without an assigned user (assigned_to IS NULL)

-- 1. Create Trigger Function
CREATE OR REPLACE FUNCTION public.handle_lead_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only assign if currently NULL
  IF NEW.assigned_to IS NULL THEN
    -- Get next user from round-robin distribution
    NEW.assigned_to := public.get_next_assigned_user();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger on LEADS table
DROP TRIGGER IF EXISTS on_lead_inserted_assign ON public.leads;

CREATE TRIGGER on_lead_inserted_assign
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.handle_lead_assignment();

-- 3. Verify get_next_assigned_user permission (just in case)
GRANT EXECUTE ON FUNCTION public.get_next_assigned_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_assigned_user() TO service_role;
