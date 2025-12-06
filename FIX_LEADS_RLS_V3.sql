-- ==============================================================================
-- FIX LEADS RLS V3 (SOLUÇÃO DEFINITIVA)
-- OBJETIVO: Desbloqueio total e simples para usuários logados.
-- MOTIVO: Scripts anteriores mantiveram complexidade que está bloqueando.
-- ==============================================================================

BEGIN;

-- 1. LIMPEZA TOTAL (NUCLEAR) DE LEADS
DROP POLICY IF EXISTS "Leads: Admin Full Access" ON public.leads;
DROP POLICY IF EXISTS "Leads: View Assigned" ON public.leads;
DROP POLICY IF EXISTS "Leads: update Assigned" ON public.leads;
DROP POLICY IF EXISTS "Leads: Update Assigned" ON public.leads;
DROP POLICY IF EXISTS "Leads: Insert" ON public.leads;
DROP POLICY IF EXISTS "Leads: Update All" ON public.leads;

-- 2. GARANTIR RLS ATIVO
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICA ÚNICA DE ACESSO (SIMPLIFICADA)
-- Permitir TUDO para qualquer usuário AUTENTICADO.
-- Motivo: O sistema é fechado, só entra quem tem login.
-- Se tem login, pode ver e editar os leads.
-- Isso elimina erro de "Lead sem dono" ou "Erro de checagem de Admin".

CREATE POLICY "Leads: Authenticated Access" ON public.leads
FOR ALL
USING (auth.role() = 'authenticated');

-- 4. GRANT EXPLICITO (Pra garantir que o postgres não reclame)
GRANT ALL ON TABLE public.leads TO authenticated;

COMMIT;
