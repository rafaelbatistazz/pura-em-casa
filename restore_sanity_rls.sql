-- ==============================================================================
-- RESTAURAÇÃO DE SANIDADE: RLS Seguro e Funcional
-- ==============================================================================

-- 1. Habilitar RLS (Segurança básica)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Limpar todas as políticas (Começar do zero)
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_select_all" ON public.users;
DROP POLICY IF EXISTS "users_no_insert" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
-- Limpar quaisquer outras políticas perdidas
DO $$ 
DECLARE r RECORD; 
BEGIN 
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP 
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.users'; 
  END LOOP; 
END $$;

-- 3. Política de Leitura: Todos os autenticados podem ler TUDO da tabela users
-- Necessário para listar usuários na config e ler o próprio perfil
CREATE POLICY "authenticated_can_select_all" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Política de Escrita (UPDATE/DELETE): Apenas Admin
CREATE POLICY "admin_can_update_delete" 
ON public.users 
FOR ALL 
TO authenticated 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- 5. Garantir permissões de tabela (GRANT)
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- 6. Verificação Final: Quem é admin?
SELECT email, role, is_first_user FROM public.users WHERE role = 'admin';
