-- ==============================================================================
-- SCRIPT DE CORREÇÃO DE PERMISSÕES E LIMPEZA (V4)
-- ==============================================================================

-- 1. Limpar duplicatas na tabela user_roles
-- Mantém apenas o registro mais recente para cada usuário
DELETE FROM public.user_roles a USING public.user_roles b
WHERE a.id < b.id AND a.user_id = b.user_id;

-- 2. Adicionar restrição UNIQUE para evitar duplicatas futuras
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- 3. FORÇAR Admin para todos os usuários existentes
UPDATE public.users SET role = 'admin'::public.app_role;
UPDATE public.user_roles SET role = 'admin'::public.app_role;

-- 4. Garantir que todo user tenha um user_role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM public.users
ON CONFLICT (user_id) DO UPDATE SET role = 'admin'::public.app_role;

-- 5. Conferência (Opcional - apenas para debug visual se rodar no SQL Editor)
SELECT id, email, role FROM public.users;
