-- FIX VISIBILITY V2 (NUCLEAR OPTION)
-- The previous script might have failed because an OLD policy (like "Enable read access for all users") 
-- remained active. Postgres RLS is "OR" based, so if ANY policy says "yes", the user sees data.

-- 1. DROP ALL POSSIBLE POLICIES on LEADS
DROP POLICY IF EXISTS "View leads" ON public.leads;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.leads;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Select leads_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_policy" ON public.leads;

-- 2. RE-CREATE STRICT POLICY (LEADS)
CREATE POLICY "View leads" ON public.leads
FOR SELECT
USING (
  -- ADMIN CHECK (Checks app_profiles)
  (EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin'))
  OR 
  -- USER CHECK (Strict Assignment)
  assigned_to = auth.uid()
);

-- 3. DROP ALL POSSIBLE POLICIES on MESSAGES
DROP POLICY IF EXISTS "View messages" ON public.messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.messages;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "messages_policy" ON public.messages;

-- 4. RE-CREATE STRICT POLICY (MESSAGES)
CREATE POLICY "View messages" ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE id = messages.lead_id 
    -- We don't need to re-check roles here because the subquery 
    -- effectively inherits the RLS scope of the "leads" table!
  )
);

-- 5. VERIFY ADMIN DELETE POLICY (Ensure it exists)
DROP POLICY IF EXISTS "Only admins can delete leads" ON public.leads;
CREATE POLICY "Only admins can delete leads" ON public.leads
FOR DELETE
USING (
  (EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin'))
);
