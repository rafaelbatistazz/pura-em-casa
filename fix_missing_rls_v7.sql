-- ==============================================================================
-- SCRIPT DE CORREÇÃO RLS (V7) - TABELAS FALTANTES
-- ==============================================================================

-- 1. USER ROLES (Estava bloqueada por falta de policy)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read User Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin Manage User Roles" ON public.user_roles;

-- Leitura: Permitida para saber roles (necessário para login/verificação)
CREATE POLICY "Read User Roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Escrita: Apenas Admin
CREATE POLICY "Admin Manage User Roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin());

-- 2. INSTANCES (Legacy/Evolution API)
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin Manage Instances" ON public.instances;

-- Apenas Admin gerencia instâncias
CREATE POLICY "Admin Manage Instances" ON public.instances FOR ALL TO authenticated USING (public.is_admin());

-- 3. N8N Tables (Garantir acesso para integração)
-- Permitir leitura/escrita para autenticados (simplificado para evitar travamento em webhook)
DROP POLICY IF EXISTS "N8N Access" ON public.n8n_dados_cliente;
CREATE POLICY "N8N Access" ON public.n8n_dados_cliente FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "N8N Msg Access" ON public.n8n_fila_mensagens;
CREATE POLICY "N8N Msg Access" ON public.n8n_fila_mensagens FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "N8N Hist Access" ON public.n8n_historico_mensagens;
CREATE POLICY "N8N Hist Access" ON public.n8n_historico_mensagens FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "N8N Status Access" ON public.n8n_status_atendimento;
CREATE POLICY "N8N Status Access" ON public.n8n_status_atendimento FOR ALL TO authenticated USING (true);

-- 4. Garantir que ADMIN sempre pode dar INSERT em USERS (caso o edge function use user logado)
DROP POLICY IF EXISTS "Admin Insert Users" ON public.users;
CREATE POLICY "Admin Insert Users" ON public.users FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ==============================================================================
-- Fim do Script
-- ==============================================================================
