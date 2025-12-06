-- ==============================================================================
-- FODA-SE O RLS - DESABILITAR TUDO
-- ==============================================================================

-- DESABILITAR RLS na tabela users
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Verificar que RLS está desabilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'users';

-- Testar se consegue ver os usuários agora
SELECT id, email, name, role, is_first_user
FROM public.users
ORDER BY created_at ASC;
