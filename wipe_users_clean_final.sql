-- ==============================================================================
-- SCRIPT DE LIMPEZA NUCLEAR DE USUÁRIOS (V2 - DEFINITIVO)
-- OBJETIVO: Apagar TODOS os vestígios de usuários, roles e permissões para evitar conflitos.
-- DATA: 2025-12-05
-- ==============================================================================

-- 1. DESABILITAR RLS TEMPORARIAMENTE PARA EVITAR BLOQUEIOS DURANTE A LIMPEZA
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_distribution DISABLE ROW LEVEL SECURITY;

-- 2. LIMPAR REFERÊNCIAS EM OUTRAS TABELAS (CRÍTICO PARA RECRIAÇÃO)
-- Se não fizermos isso, recriar as Constraints de Foreign Key vai falhar depois
DO $$
BEGIN
    -- Remove atribuições de leads para usuários que vão deixar de existir
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
        UPDATE public.leads SET assigned_to = NULL;
    END IF;

    -- Remove criadores de atalhos
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_shortcuts') THEN
        UPDATE public.message_shortcuts SET created_by = NULL;
    END IF;
    
    -- Limpa tabela de distribuição (ela é dependente 100% de usuários)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_distribution') THEN
        DELETE FROM public.lead_distribution;
    END IF;
END $$;

-- 3. DROP DE TABELAS DE USUÁRIO (COM CASCADE)
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 4. DROP DE FUNÇÕES E TRIGGERS RELACIONADOS
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_profile() CASCADE;
DROP FUNCTION IF EXISTS public.get_all_users() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_assigned_user() CASCADE; -- Depende de users

-- 5. DROP DE TYPES
DROP TYPE IF EXISTS public.app_role CASCADE;

-- 6. REMOÇÃO AGRESSIVA DE TRIGGERS NO SCHEMA AUTH
-- Isso busca e remove qualquer trigger na tabela auth.users que possa ter sobrado
DO $$
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'auth' 
        AND event_object_table = 'users'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users CASCADE', trg.trigger_name);
    END LOOP;
END $$;

-- 7. (OPCIONAL/RECOMENDADO) LIMPAR A TABELA AUTH.USERS DO SUPABASE
-- ISSO VAI DESLOGAR TODO MUNDO E EXIGIR NOVO CADASTRO.
-- ÚNICA FORMA DE GARANTIR ZERO "LIXO" DE ESTADOS ANTERIORES.
DELETE FROM auth.users;

-- 8. CONFIRMAÇÃO
DO $$
BEGIN
    RAISE NOTICE 'LIMPEZA COMPLETA CONCLUÍDA. O SISTEMA ESTÁ PRONTO PARA RECONSTRUÇÃO.';
END $$;
