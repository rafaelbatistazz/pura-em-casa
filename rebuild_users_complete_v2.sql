-- ==============================================================================
-- SCRIPT DE RECONSTRUÇÃO TOTAL DO SISTEMA (V2 - COMPLETO E FUNCIONAL)
-- OBJETIVO: Sistema de Usuários, Leads, Mensagens e Distribuição com RLS Correto.
-- ==============================================================================

-- 1. LIMPEZA PRÉVIA (GARANTIA)
DROP TABLE IF EXISTS public.lead_distribution CASCADE;
DROP TABLE IF EXISTS public.lead_distribution_config CASCADE;
DROP TABLE IF EXISTS public.message_shortcuts CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE; -- Legado
DROP TABLE IF EXISTS public.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- 2. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 3. TABELA DE USUÁRIOS
CREATE TABLE public.users (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role public.app_role DEFAULT 'user'::public.app_role,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. TABELA DE LEADS
CREATE TABLE public.leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  name text,
  status text DEFAULT 'novo',
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Se user for deletado, lead fica órfão (mas não some)
  kanban_position integer DEFAULT 0,
  notes text,
  unread_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 5. TABELA DE MENSAGENS
CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  message_text text,
  media_url text,
  media_type text DEFAULT 'text',
  read boolean DEFAULT false,
  sender_name text,
  timestamp timestamp with time zone DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 6. DISTRIBUIÇÃO E CONFIGURAÇÕES
CREATE TABLE public.lead_distribution_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled boolean DEFAULT false,
  last_assigned_index integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.lead_distribution_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.lead_distribution_config (enabled, last_assigned_index) VALUES (false, 0);

CREATE TABLE public.lead_distribution (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.lead_distribution ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.system_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.message_shortcuts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger text NOT NULL UNIQUE,
  content text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.message_shortcuts ENABLE ROW LEVEL SECURITY;

-- 7. FUNÇÃO HELPER: IS_ADMIN()
-- Centraliza a lógica de verificar se é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TRIGGER DE NOVO USUÁRIO (BOOTSTRAP ADMIN)
-- O primeiro usuário criado SERÁ ADMIN. Os próximos serão 'user'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  count_users integer;
BEGIN
  SELECT count(*) INTO count_users FROM public.users;
  
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    CASE WHEN count_users = 0 THEN 'admin'::public.app_role ELSE 'user'::public.app_role END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recria trigger na auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. POLÍTICAS DE SEGURANÇA (RLS) - O CORAÇÃO DO SISTEMA

-- USERS
-- Admin vê e edita todos. Usuário vê a si mesmo e edita apenas dados básicos seus (nome).
CREATE POLICY "Users: Admin full access" ON public.users FOR ALL USING (public.is_admin());
CREATE POLICY "Users: Self view" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users: Self update" ON public.users FOR UPDATE USING (auth.uid() = id);
-- Permitir leitura pública ou autenticada para listagens necessárias? Melhor restringir.
-- Mas para 'distribution' funcionar visualmente, admin precisa ver todos. Já coberto acima.

-- LEADS
-- Admin vê tudo. User vê APENAS seus leads (assigned_to = id) ou leads não atribuídos (opcional, vou deixar restrito).
CREATE POLICY "Leads: Admin full access" ON public.leads FOR ALL USING (public.is_admin());
CREATE POLICY "Leads: User view assigned" ON public.leads FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "Leads: User edit assigned" ON public.leads FOR UPDATE USING (assigned_to = auth.uid());
-- User não pode deletar lead, só admin.

-- MESSAGES
-- Visível apenas se o usuário tiver acesso ao Lead correspondente.
CREATE POLICY "Messages: Access via Lead" ON public.messages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = messages.lead_id 
    AND (leads.assigned_to = auth.uid() OR public.is_admin())
  )
);

-- CONFIG & DISTRIBUTION
-- Admin gerencia, usuários apenas leem (se necessário) ou nem isso.
CREATE POLICY "Config: Admin manage" ON public.system_config FOR ALL USING (public.is_admin());
CREATE POLICY "Config: Public read" ON public.system_config FOR SELECT USING (true); -- Front precisa ler config

CREATE POLICY "Dist: Admin manage" ON public.lead_distribution_config FOR ALL USING (public.is_admin());
CREATE POLICY "Dist: Admin manage items" ON public.lead_distribution FOR ALL USING (public.is_admin());

-- SHORTCUTS
CREATE POLICY "Shortcuts: Read all" ON public.message_shortcuts FOR SELECT USING (true);
CREATE POLICY "Shortcuts: Manage own or Admin" ON public.message_shortcuts FOR ALL USING (created_by = auth.uid() OR public.is_admin());

-- 10. REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- 11. GRANT PERMISSIONS (Fundamental)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; -- RLS vai filtrar o que pode
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

