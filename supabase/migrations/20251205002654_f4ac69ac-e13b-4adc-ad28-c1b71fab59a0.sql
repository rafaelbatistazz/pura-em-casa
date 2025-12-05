-- First, unassign leads from orphan users
UPDATE public.leads 
SET assigned_to = NULL
WHERE assigned_to IN (
  SELECT id FROM public.users 
  WHERE id NOT IN (SELECT id FROM auth.users)
);

-- Then delete orphan users from public.users
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);