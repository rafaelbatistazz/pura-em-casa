-- ==============================================================================
-- SOLUÇÃO DEFINITIVA: RLS que REALMENTE funciona
-- ==============================================================================

-- 1. DELETAR TODAS as políticas
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

-- 2. Criar políticas ULTRA SIMPLES que funcionam

-- SELECT: Todos autenticados podem ver todos os usuários
CREATE POLICY "users_select_all" ON public.users 
  FOR SELECT 
  TO authenticated
  USING (true);  -- TODOS podem ver

-- INSERT: Bloqueado (só via trigger)
CREATE POLICY "users_no_insert" ON public.users 
  FOR INSERT 
  TO authenticated
  WITH CHECK (false);

-- UPDATE: Apenas quem tem role='admin' na própria linha
CREATE POLICY "users_update_admin" ON public.users 
  FOR UPDATE 
  TO authenticated
  USING (
    -- Verifica se o usuário logado tem role admin
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    -- Verifica se o usuário logado tem role admin
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: Apenas admin, mas não pode deletar o primeiro usuário
CREATE POLICY "users_delete_admin" ON public.users 
  FOR DELETE 
  TO authenticated
  USING (
    -- Verifica se o usuário logado tem role admin
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
    AND is_first_user = false  -- Não pode deletar o primeiro
  );

-- 3. Verificar políticas criadas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 4. Testar se você consegue ver os usuários
SELECT id, email, name, role, is_first_user
FROM public.users
ORDER BY created_at ASC;
