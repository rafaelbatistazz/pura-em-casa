-- ==============================================================================
-- SCRIPT DE CORREÇÃO DE PERMISSÕES (V8) - RETRY PÓS-RLS
-- ==============================================================================

-- Agora que as tabelas estão destrancadas (V7), vamos garantir que você é Admin
-- (O script anterior pode ter falhado silenciosamente por causa do bloqueio)

-- 1. Forçar Admin na tabela principal de usuários
UPDATE public.users 
SET role = 'admin'::public.app_role;

-- 2. Forçar Admin na tabela de cargos (usada pela Edge Function)
-- Primeiro, deleta para garantir limpo
DELETE FROM public.user_roles;

-- Reinsere todo mundo como Admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM public.users;

-- 3. Verificação (Mostra quantos admins existem agora)
SELECT count(*) as total_admins FROM public.user_roles WHERE role = 'admin';
