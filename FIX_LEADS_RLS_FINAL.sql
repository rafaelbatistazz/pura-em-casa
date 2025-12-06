-- ==============================================================================
-- FIX LEADS RLS FINAL (CORREÇÃO DE PERMISSÕES DE LEADS)
-- OBJETIVO: Permitir salvar observações e editar leads (Admin e Dono).
-- MOTIVO: A função antiga is_admin() foi apagada, quebrando as regras antigas.
-- ==============================================================================

BEGIN;

-- 1. LIMPAR POLÍTICAS QUEBRADAS
DROP POLICY IF EXISTS "Leads: Admin Full Access" ON public.leads;
DROP POLICY IF EXISTS "Leads: View Assigned" ON public.leads;
DROP POLICY IF EXISTS "Leads: update Assigned" ON public.leads;
DROP POLICY IF EXISTS "Leads: Update Assigned" ON public.leads; -- Case sensitive check

-- 2. GARANTIR RLS ATIVO
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 3. CRIAR NOVAS POLÍTICAS (USANDO O NOVO SISTEMA)

-- ADMIN: Faz tudo (Usa a função is_app_admin criada anteriormente)
CREATE POLICY "Leads: Admin Full Access" ON public.leads
FOR ALL USING (public.is_app_admin());

-- USUÁRIO PADRÃO: Vê os seus leads ou os sem dono
CREATE POLICY "Leads: View Assigned" ON public.leads
FOR SELECT USING (
  assigned_to = auth.uid() 
  OR 
  assigned_to IS NULL
);

-- USUÁRIO PADRÃO: Pode editar os seus (Status, Notas, etc)
CREATE POLICY "Leads: Update Assigned" ON public.leads
FOR UPDATE USING (assigned_to = auth.uid());

-- USUÁRIO PADRÃO: Pode criar leads (Se necessário)
CREATE POLICY "Leads: Insert" ON public.leads
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. GRANT PERMISSIONS
GRANT ALL ON TABLE public.leads TO authenticated;

COMMIT;
