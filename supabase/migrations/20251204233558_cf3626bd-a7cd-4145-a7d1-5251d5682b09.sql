-- Fix the infinite recursion in users table RLS policy
DROP POLICY IF EXISTS "Users can view own profile and admins see all" ON public.users;

-- Create corrected policy using has_role() function to avoid recursion
CREATE POLICY "Users can view own profile and admins see all" ON public.users
FOR SELECT
TO authenticated
USING ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));