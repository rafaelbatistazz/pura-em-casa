-- ==============================================================================
-- CLEAN SLATE - APAGAR TUDO RELACIONADO A USUÁRIOS
-- ==============================================================================

-- 1. Deletar Tabelas Públicas
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. Deletar Funções
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_profile() CASCADE;
DROP FUNCTION IF EXISTS public.get_all_users() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

-- 3. Deletar Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- 4. Deletar Tipos
DROP TYPE IF EXISTS public.app_role CASCADE;

-- 5. LIMPAR Auth Users (Opcional, mas recomendado para começar 100% fresco)
-- Descomente a linha abaixo se quiser forçar logout de todo mundo e login novo
DELETE FROM auth.users;

-- FIM - O banco agora não tem nada sobre gestão customizada de usuários.
