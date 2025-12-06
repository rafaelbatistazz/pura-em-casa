-- ==============================================================================
-- HARD RESET DE USUÁRIOS (V11) - CORREÇÃO DE ID MISMATCH
-- ==============================================================================

-- O problema: O ID do seu login (Auth) está diferente do ID na tabela de dados (Public).
-- Solução: Apagar os dados antigos da tabela pública e puxar os corretos do Auth.

-- 1. Limpar tabelas públicas (apenas dados de usuário, não leads/mensagens)
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.users CASCADE;

-- 2. Sincronizar DO ZERO a partir do sistema de Login (Auth)
INSERT INTO public.users (id, email, name, role, created_at)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'name', email) as name, 
    'admin'::public.app_role as role, -- Forçar todos como Admin
    created_at
FROM auth.users;

-- 3. Preencher tabela de cargos (User Roles)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM public.users;

-- 4. Verificação (Confira se o ID bate com o que você vê no Auth)
SELECT id, email, role FROM public.users;
