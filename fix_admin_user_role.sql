-- ==============================================================================
-- CORREÇÃO: Garantir que usuário admin tenha registro correto em user_roles
-- PROBLEMA: Edge Function create-user falha ao verificar se usuário é admin
-- DATA: 2025-12-05
-- ==============================================================================

-- 1. Verificar estado atual do usuário admin
SELECT 
  u.id,
  u.email,
  u.name,
  u.role as users_role,
  ur.role as user_roles_role,
  ur.id as user_roles_id
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'gt.rafaa@gmail.com';

-- 2. Verificar todos os usuários e seus registros em user_roles
SELECT 
  u.id,
  u.email,
  u.role as users_role,
  ur.role as user_roles_role,
  CASE 
    WHEN ur.user_id IS NULL THEN 'MISSING'
    WHEN u.role != ur.role THEN 'MISMATCH'
    ELSE 'OK'
  END as status
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at;

-- 3. Corrigir: Inserir ou atualizar registro do admin em user_roles
-- Primeiro, tentar inserir (caso não exista)
INSERT INTO public.user_roles (user_id, role)
SELECT id, role
FROM public.users
WHERE email = 'gt.rafaa@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = users.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Depois, garantir que o role está correto (atualizar se necessário)
UPDATE public.user_roles ur
SET role = u.role
FROM public.users u
WHERE ur.user_id = u.id
  AND u.email = 'gt.rafaa@gmail.com'
  AND ur.role != u.role;

-- 4. Garantir que TODOS os usuários tenham registro em user_roles
-- (sincronizar qualquer usuário que esteja faltando)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, u.role
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Corrigir qualquer mismatch entre users.role e user_roles.role
UPDATE public.user_roles ur
SET role = u.role
FROM public.users u
WHERE ur.user_id = u.id
  AND ur.role != u.role;

-- 6. Verificação final - deve mostrar tudo OK
SELECT 
  u.id,
  u.email,
  u.role as users_role,
  ur.role as user_roles_role,
  CASE 
    WHEN ur.user_id IS NULL THEN 'MISSING'
    WHEN u.role != ur.role THEN 'MISMATCH'
    ELSE 'OK'
  END as status
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at;

-- 7. Confirmar que o admin específico está correto
SELECT 
  'Admin user check:' as info,
  u.email,
  u.role as users_role,
  ur.role as user_roles_role
FROM public.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'gt.rafaa@gmail.com';
