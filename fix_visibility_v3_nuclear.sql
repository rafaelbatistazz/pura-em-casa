-- FIX VISIBILITY V3 (DYNAMIC NUCLEAR OPTION)
-- This script uses a DO block to dynamically find and DROP ALL policies on the leads table.
-- This ensures that no matter what the policies are named, they will be removed.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. LOOP AND DROP ALL POLICIES ON LEADS
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'leads' AND schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.leads', r.policyname);
    END LOOP;

    -- 2. LOOP AND DROP ALL POLICIES ON MESSAGES
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', r.policyname);
    END LOOP;
END $$;

-- 3. ENSURE RLS IS ENABLED (Crucial)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. CREATE STRICT POLICY (LEADS)
-- Only Admin or Assigned User can SEE
CREATE POLICY "Strict View Leads" ON public.leads
FOR SELECT
USING (
  -- Check Admin Role in app_profiles matches auth.uid
  (SELECT role FROM public.app_profiles WHERE id = auth.uid()) = 'admin'
  OR 
  -- Or belongs to user
  assigned_to = auth.uid()
);

-- 5. CREATE STRICT POLICY (MESSAGES)
-- Inherits permission from Leads
CREATE POLICY "Strict View Messages" ON public.messages
FOR SELECT
USING (
  EXISTS (
     SELECT 1 FROM public.leads 
     WHERE id = messages.lead_id 
     -- Re-verify access logic here to be safe
     AND (
        (SELECT role FROM public.app_profiles WHERE id = auth.uid()) = 'admin'
        OR 
        assigned_to = auth.uid()
     )
  )
);

-- 6. ADMIN DELETE POLICY
CREATE POLICY "Admin Delete Leads" ON public.leads
FOR DELETE
USING (
  (SELECT role FROM public.app_profiles WHERE id = auth.uid()) = 'admin'
);

-- 7. INSERT POLICY (Anyone authenticated can create, but RLS for Select applies immediately)
CREATE POLICY "Enable insert for authenticated users" ON public.leads
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for messages" ON public.messages
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 8. UPDATE POLICY (Users can update their own leads, Admins update all)
CREATE POLICY "Strict Update Leads" ON public.leads
FOR UPDATE
USING (
  (SELECT role FROM public.app_profiles WHERE id = auth.uid()) = 'admin'
  OR 
  assigned_to = auth.uid()
);
