-- ==============================================================================
-- DIAGNÓSTICO E CORREÇÃO: Trigger não está funcionando
-- ==============================================================================

-- 1. Verificar se o trigger existe
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- 2. Verificar quantos usuários existem em auth.users vs public.users
SELECT 
  (SELECT COUNT(*) FROM auth.users) as usuarios_auth,
  (SELECT COUNT(*) FROM public.users) as usuarios_public;

-- 3. Listar usuários em auth.users
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- 4. SOLUÇÃO: Inserir manualmente os usuários que existem em auth.users mas não em public.users
INSERT INTO public.users (id, email, name, role, is_first_user)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.email) as name,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM public.users) THEN 'admin'::public.app_role
    ELSE 'user'::public.app_role
  END as role,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM public.users) THEN true
    ELSE false
  END as is_first_user
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ORDER BY au.created_at ASC;

-- 5. Verificar resultado
SELECT 
  id,
  email,
  name,
  role,
  is_first_user,
  created_at
FROM public.users
ORDER BY created_at ASC;
