-- FIX VISIBILITY V4 (SNIPER MODE)
-- Based on the screenshot provided, these are the specific policies 
-- that are likely overriding the strict visibility rules.

-- 1. DROP SPECIFIED PERMISSIVE POLICIES ON LEADS
DROP POLICY IF EXISTS "Leads: Authenticated Access" ON public.leads;
DROP POLICY IF EXISTS "Leads: Check Assigned" ON public.leads;

-- 2. DROP SPECIFIED PERMISSIVE POLICIES ON MESSAGES
DROP POLICY IF EXISTS "Messages: Admin Full Access" ON public.messages;
DROP POLICY IF EXISTS "Messages: View Assigned" ON public.messages;

-- 3. ENSURE STRICT POLICIES EXIST (Safety Check)
-- We re-run the strict policy creation just to be 100% sure the 'View leads' 
-- and 'View messages' policies are the correct strict versions version we defined in V2/V3.

-- Re-create Strict View for Leads
DROP POLICY IF EXISTS "View leads" ON public.leads;
CREATE POLICY "View leads" ON public.leads
FOR SELECT
USING (
  -- Admin Check
  (EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin'))
  OR 
  -- User Check (Strict Assignment)
  assigned_to = auth.uid()
);

-- Re-create Strict View for Messages
DROP POLICY IF EXISTS "View messages" ON public.messages;
CREATE POLICY "View messages" ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE id = messages.lead_id 
    AND (
      (EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin'))
      OR 
      assigned_to = auth.uid()
    )
  )
);
