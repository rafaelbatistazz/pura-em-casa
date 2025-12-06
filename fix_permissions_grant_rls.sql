-- ==============================================================================
-- CORREÇÃO TOTAL DE PERMISSÕES (GRANT + RLS)
-- ==============================================================================

-- 1. Habilitar RLS (Necessário para as políticas funcionarem bem no Supabase)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Conceder permissões de tabela (GRANT)
-- Isso resolve o erro "permission denied" se não for RLS
GRANT ALL ON TABLE public.users TO postgres;
GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- 3. Limpar políticas antigas
DROP POLICY IF EXISTS "allow_all" ON public.users;
DROP POLICY IF EXISTS "users_select_all" ON public.users;
DROP POLICY IF EXISTS "users_no_insert" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

-- 4. Criar Política "Liberou Geral" (Temporária para Debug)
-- Permite SELECT, INSERT, UPDATE, DELETE para qualquer usuário logado
CREATE POLICY "allow_all_authenticated" 
ON public.users 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Verificar e Retornar
SELECT 
  tablename, 
  policyname, 
  cmd, 
  roles 
FROM pg_policies 
WHERE tablename = 'users';
