-- Verificar se os usuários existem no banco
SELECT 
  id,
  email,
  name,
  role,
  is_first_user,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- Verificar políticas RLS
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Testar se você consegue ver os usuários com sua sessão
SELECT 
  auth.uid() as meu_id,
  (SELECT COUNT(*) FROM public.users) as total_usuarios,
  (SELECT role FROM public.users WHERE id = auth.uid()) as minha_role;
