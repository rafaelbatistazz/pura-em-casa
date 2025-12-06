-- ==============================================================================
-- SCRIPT DE RESTAURAÇÃO DE SEGURANÇA (RLS STRICT)
-- Reforça Isolamento de Leads e Segurança de Perfil
-- ==============================================================================

-- 1. Helper: Verificar se é Admin (Seguro e Performático)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
SELECT EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = 'admin'
);
$$ LANGUAGE sql SECURITY DEFINER;

-- ==============================================================================
-- 2. TABELA LEADS (Isolamento Rígido)
-- ==============================================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Limpar policies permissivas anteriores
DROP POLICY IF EXISTS "Public Read leads" ON public.leads;
DROP POLICY IF EXISTS "Public Write leads" ON public.leads;
DROP POLICY IF EXISTS "Allow All leads" ON public.leads;
DROP POLICY IF EXISTS "View Assigned Leads" ON public.leads;
DROP POLICY IF EXISTS "Update Assigned Leads" ON public.leads;
DROP POLICY IF EXISTS "Insert Leads" ON public.leads;

-- Visualizar: Apenas Admin OU Dono do Lead
CREATE POLICY "View Assigned Leads" ON public.leads
FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid() OR
  public.is_admin()
);

-- Editar: Apenas Admin OU Dono do Lead
CREATE POLICY "Update Assigned Leads" ON public.leads
FOR UPDATE TO authenticated
USING (
  assigned_to = auth.uid() OR
  public.is_admin()
);

-- Criar: Qualquer usuário autenticado (ex: criar lead manual)
CREATE POLICY "Insert Leads" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (true);

-- Deletar: Apenas Admin
CREATE POLICY "Delete Leads" ON public.leads
FOR DELETE TO authenticated
USING (public.is_admin());

-- ==============================================================================
-- 3. TABELA MESSAGES (Herda acesso do Lead)
-- ==============================================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read messages" ON public.messages;
DROP POLICY IF EXISTS "Public Write messages" ON public.messages;
DROP POLICY IF EXISTS "View Lead Messages" ON public.messages;
DROP POLICY IF EXISTS "Insert Messages" ON public.messages;

-- Ver mensagens: Se tem acesso ao Lead, tem acesso às mensagens
CREATE POLICY "View Lead Messages" ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = messages.lead_id
    AND (leads.assigned_to = auth.uid() OR public.is_admin())
  )
);

-- Enviar mensagens: Se tem acesso ao Lead, pode enviar
CREATE POLICY "Insert Messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_id
    AND (leads.assigned_to = auth.uid() OR public.is_admin())
  )
);

-- ==============================================================================
-- 4. TABELA USERS (Perfil e Diretório)
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read users" ON public.users;
DROP POLICY IF EXISTS "Public Write users" ON public.users;
DROP POLICY IF EXISTS "Allow All Users Select" ON public.users;
DROP POLICY IF EXISTS "View All Users" ON public.users;
DROP POLICY IF EXISTS "Update Own Profile" ON public.users;

-- Ver: Todos podem ver a lista de usuários (necessário para atribuição/chat)
CREATE POLICY "View All Users" ON public.users
FOR SELECT TO authenticated
USING (true);

-- Editar: Apenas o PRÓPRIO usuário ou Admin
CREATE POLICY "Update Own Profile" ON public.users
FOR UPDATE TO authenticated
USING (
  id = auth.uid() OR
  public.is_admin()
);

-- ==============================================================================
-- 5. CONFIGURAÇÕES E SISTEMA (Acesso Restrito)
-- ==============================================================================

-- System Config: Ler (Todos), Editar (Admin)
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read system_config" ON public.system_config;
DROP POLICY IF EXISTS "Public Write system_config" ON public.system_config;

CREATE POLICY "Read Config" ON public.system_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Write Config" ON public.system_config FOR ALL TO authenticated USING (public.is_admin());

-- Message Shortcuts: Ler (Todos), Editar (Admin)
ALTER TABLE public.message_shortcuts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read message_shortcuts" ON public.message_shortcuts;
DROP POLICY IF EXISTS "Public Write message_shortcuts" ON public.message_shortcuts;

CREATE POLICY "Read Shortcuts" ON public.message_shortcuts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Shortcuts" ON public.message_shortcuts FOR ALL TO authenticated USING (public.is_admin());

-- Lead Distribution: Apenas Admin
ALTER TABLE public.lead_distribution ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read lead_distribution" ON public.lead_distribution;
DROP POLICY IF EXISTS "Public Write lead_distribution" ON public.lead_distribution;

CREATE POLICY "Admin Distribution" ON public.lead_distribution FOR ALL TO authenticated USING (public.is_admin());

ALTER TABLE public.lead_distribution_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read lead_distribution_config" ON public.lead_distribution_config;
DROP POLICY IF EXISTS "Public Write lead_distribution_config" ON public.lead_distribution_config;

CREATE POLICY "Admin Distribution Config" ON public.lead_distribution_config FOR ALL TO authenticated USING (public.is_admin());

-- ==============================================================================
-- Fim do Script
-- ==============================================================================
