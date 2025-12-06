-- ==============================================================================
-- SCRIPT DE CORREÇÃO: PROMOVER USUÁRIO A ADMIN
-- ==============================================================================

-- Atualiza TODOS os usuários atuais para 'admin' (para garantir que você tenha acesso)
UPDATE public.users 
SET role = 'admin'::public.app_role;

-- Atualiza também a tabela redundante user_roles
UPDATE public.user_roles
SET role = 'admin'::public.app_role;
