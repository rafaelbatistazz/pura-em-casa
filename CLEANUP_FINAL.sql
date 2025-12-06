-- ==============================================================================
-- CLEANUP FINAL (A VASSOURA) 🧹
-- OBJETIVO: Apagar TODO o sistema antigo (Tabelas, Colunas, Funções)
-- DEIXANDO APENAS O NOVO (app_profiles).
-- ==============================================================================

BEGIN;

-- 1. APAGAR TABELAS ANTIGAS
-- "CASCADE" garante que se tiver link sobrando, ele corta.
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- 2. APAGAR FUNÇÕES ANTIGAS
-- (Aquelas que manipulavam a tabela users ou user_roles)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.check_user_role(uuid, text) CASCADE;

-- 3. LIMPEZA DE COLUNAS ORFÃS EM OUTRAS TABELAS (SE HOUVER)
-- Removemos referências antigas que podem ter ficado
DO $$ 
BEGIN
    -- Se a tabela leads ainda tiver a coluna old_assigned_to (exemplo), apaga
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'old_user_id') THEN
        ALTER TABLE public.leads DROP COLUMN old_user_id;
    END IF;
END $$;

-- 4. LIMPEZA DE DADOS (GARANTIR INTEGRIDADE NO NOVO SISTEMA)
-- Remove perfis em app_profiles que não tem mais usuário no Auth (Lixo)
DELETE FROM public.app_profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- 5. RE-CONFIRMAÇÃO DE PERMISSÕES NA TABELA NOVA
GRANT ALL ON public.app_profiles TO postgres, service_role;
GRANT SELECT ON public.app_profiles TO authenticated;

COMMIT;

-- FIM DA LIMPEZA. AGORA SÓ EXISTE O NOVO.
