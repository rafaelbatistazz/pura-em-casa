-- FIX INSERT AND SECURE RPC
-- 1. Create Helper RPC to check lead existence safely (bypassing RLS for check only)
CREATE OR REPLACE FUNCTION public.check_lead_status(phone_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin to see all leads
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_assigned_to uuid;
  v_assigned_name text;
  v_exists boolean;
BEGIN
  -- Normalize phone (simple check matching frontend)
  -- Assuming input is already normalized or close to it. 
  
  SELECT id, assigned_to INTO v_lead_id, v_assigned_to
  FROM leads 
  WHERE phone = phone_number 
  LIMIT 1;
  
  IF v_lead_id IS NOT NULL THEN
    -- Lead Exists
    -- Get user name if assigned
    IF v_assigned_to IS NOT NULL THEN
      SELECT name INTO v_assigned_name FROM app_profiles WHERE id = v_assigned_to;
      -- Fallback to users table if app_profiles is empty (legacy)
      IF v_assigned_name IS NULL THEN
         SELECT name INTO v_assigned_name FROM users WHERE id = v_assigned_to;
      END IF;
    END IF;
    
    RETURN jsonb_build_object(
      'exists', true,
      'lead_id', v_lead_id,
      'assigned_to_name', COALESCE(v_assigned_name, 'Sem responsável')
    );
  ELSE
    -- Lead does not exist
    RETURN jsonb_build_object('exists', false);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_lead_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_lead_status(text) TO service_role;

-- 2. Ensure INSERT Policy Exists for Users
-- Users need to be able to INSERT leads. RLS might be blocking this.
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.leads;

CREATE POLICY "Enable insert for authenticated users" ON public.leads
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated'
  -- We don't enforce "assigned_to = auth.uid()" here because:
  -- 1. The trigger auto-assigns if null.
  -- 2. Sometimes we might want to allow creating for others (depends on business logic, but basic insert is fine).
);
