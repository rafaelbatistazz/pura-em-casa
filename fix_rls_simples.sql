-- ==============================================================================
-- CORREÇÃO ULTRA SIMPLES: RLS usando apenas tabela USERS
-- ==============================================================================

-- 1. DELETAR TODAS as políticas
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_policy" ON public.user_roles;

-- 2. Criar políticas SIMPLES usando apenas a tabela users

-- USERS - SELECT (ver próprio perfil OU ser admin)
CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated
USING (
  auth.uid() = id OR 
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- USERS - INSERT (apenas admin)
CREATE POLICY "users_insert" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- USERS - UPDATE (apenas admin)
CREATE POLICY "users_update" ON public.users FOR UPDATE TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- USERS - DELETE (apenas admin)
CREATE POLICY "users_delete" ON public.users FOR DELETE TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- USER_ROLES - SELECT (todos podem ver)
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
USING (true);

-- USER_ROLES - INSERT (apenas admin)
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- USER_ROLES - UPDATE (apenas admin)
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- USER_ROLES - DELETE (apenas admin)
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- 3. Verificar políticas criadas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('users', 'user_roles')
ORDER BY tablename, policyname;

-- 4. Testar se você é reconhecido como admin
SELECT 
  auth.uid() as meu_id,
  u.email,
  u.role,
  CASE 
    WHEN u.role = 'admin' THEN 'SIM - Você é admin!'
    ELSE 'NÃO - Você não é admin'
  END as status
FROM public.users u
WHERE u.id = auth.uid();
