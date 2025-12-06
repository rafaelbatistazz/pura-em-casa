-- ==============================================================================
-- SCRIPT DE LIBERAÇÃO TOTAL (V5) - RESOLVER PERMISSÕES NEGADAS
-- ==============================================================================

-- 1. Desabilitar e reabilitar RLS para limpar estado (Opcional, mas bom para garantir)
ALTER TABLE public.system_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas que podem estar travando
DROP POLICY IF EXISTS "View config" ON public.system_config;
DROP POLICY IF EXISTS "Manage config" ON public.system_config;
DROP POLICY IF EXISTS "Allow read config" ON public.system_config;
DROP POLICY IF EXISTS "Allow write config" ON public.system_config;

-- 3. Criar Políticas PERMISSIVAS (Liberar geral para quem está logado)
-- Qualquer usuário logado pode LER as configs
CREATE POLICY "Public Read Config" ON public.system_config 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Qualquer usuário logado pode EDITAR as configs (Sim, liberado para resolver o bloqueio)
CREATE POLICY "Public Write Config" ON public.system_config 
    FOR ALL 
    TO authenticated 
    USING (true);

-- 4. Garantir permissões de nível de banco (Grants)
GRANT ALL ON TABLE public.system_config TO authenticated;
GRANT ALL ON TABLE public.system_config TO service_role;

-- 5. Fazer o mesmo para a tabela de Usuários (para parar o erro de users)
DROP POLICY IF EXISTS "Users view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.users;

-- Todo mundo vê todo mundo (para o chat funcionar e parar os erros)
CREATE POLICY "Allow All Users Select" ON public.users 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Garantir Grants
GRANT SELECT ON TABLE public.users TO authenticated;

-- ==============================================================================
-- Fim do Script
-- ==============================================================================
