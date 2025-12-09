-- FIX UPDATE PERMISSIONS
-- When we removed the permissive "Authenticated Access" policies, 
-- we also removed the permission to UPDATE leads (change status, user, notes).
-- This script restores that capability securely.

-- 1. ADMINS: Can udpate ANY lead
DROP POLICY IF EXISTS "Admins can update all leads" ON public.leads;
CREATE POLICY "Admins can update all leads" ON public.leads
FOR UPDATE
USING (
  (EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin'))
);

-- 2. USERS: Can update ONLY their assigned leads
DROP POLICY IF EXISTS "Users can update assigned leads" ON public.leads;
CREATE POLICY "Users can update assigned leads" ON public.leads
FOR UPDATE
USING (
  assigned_to = auth.uid()
);
