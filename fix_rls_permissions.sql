-- ==============================================================================
-- CORREÇÃO FINAL: Permitir que ADMIN faça UPDATE em users e user_roles
-- ERRO: permission denied for table users
-- ==============================================================================

-- 1. Ver políticas atuais
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('users', 'user_roles')
ORDER BY tablename, policyname;

-- 2. DELETAR TODAS as políticas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "Users view self" ON public.users;
DROP POLICY IF EXISTS "Admin full access users" ON public.users;
DROP POLICY IF EXISTS "View roles" ON public.user_roles;
DROP POLICY IF EXISTS "Manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Read User Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin Manage User Roles" ON public.user_roles;

-- 3. Criar políticas CORRETAS que permitem admin fazer tudo

-- Para tabela USERS
CREATE POLICY "users_select_policy" 
  ON public.users 
  FOR SELECT 
  TO authenticated
  USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "users_insert_policy" 
  ON public.users 
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "users_update_policy" 
  ON public.users 
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "users_delete_policy" 
  ON public.users 
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Para tabela USER_ROLES
CREATE POLICY "user_roles_select_policy" 
  ON public.user_roles 
  FOR SELECT 
  TO authenticated
  USING (true);  -- Todos podem ver roles

CREATE POLICY "user_roles_insert_policy" 
  ON public.user_roles 
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "user_roles_update_policy" 
  ON public.user_roles 
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "user_roles_delete_policy" 
  ON public.user_roles 
  FOR DELETE 
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 4. Verificar que as políticas foram criadas corretamente
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('users', 'user_roles')
ORDER BY tablename, policyname;
