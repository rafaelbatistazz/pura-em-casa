-- Limpar registros órfãos: usuários que existem em public.users mas não em auth.users

-- Primeiro deletar de user_roles (referencia users)
DELETE FROM public.user_roles 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Depois deletar de users
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);