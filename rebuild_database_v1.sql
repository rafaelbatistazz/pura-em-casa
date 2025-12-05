-- ==============================================================================
-- SCRIPT DE RECONSTRUÇÃO TOTAL DO BANCO DE DADOS (CLEAN SLATE)
-- FUSO HORÁRIO: America/Sao_Paulo
-- COLUNAS DE DATA: TIMESTAMPTZ
-- ==============================================================================

-- 1. CONFIGURAÇÃO DE FUSO HORÁRIO (CRÍTICO)
-- Força o banco a operar no horário de Brasília para todas as sessões novas.
ALTER DATABASE postgres SET timezone TO 'America/Sao_Paulo';
ALTER ROLE authenticated SET timezone TO 'America/Sao_Paulo';
ALTER ROLE service_role SET timezone TO 'America/Sao_Paulo';
ALTER ROLE postgres SET timezone TO 'America/Sao_Paulo';

-- ==============================================================================
-- 2. LIMPEZA (CUIDADO: APAGA TUDO NO ESQUEMA PUBLIC)
-- ==============================================================================
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Habilita extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 3. TIPOS E ENUMS
-- ==============================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ==============================================================================
-- 4. TABELAS
-- ==============================================================================

-- 4.1 USERS (Espelho da auth.users)
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

-- 4.2 LEADS (Tabela Principal)
CREATE TABLE public.leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL UNIQUE, -- Telefone normalizado
  name text,
  status text DEFAULT 'novo', -- 'novo', 'em_atendimento', etc.
  assigned_to uuid REFERENCES public.users(id),
  kanban_position integer DEFAULT 0,
  notes text,
  unread_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 4.3 MESSAGES (Tabela de Mensagens)
CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  message_text text,
  media_url text,
  media_type text DEFAULT 'text',
  read boolean DEFAULT false,
  sender_name text,
  -- AQUI O SEGREDO: TIMESTAMPTZ
  timestamp timestamp with time zone DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4.4 CONFIGURAÇÃO DE DISTRIBUIÇÃO
CREATE TABLE public.lead_distribution_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled boolean DEFAULT false,
  last_assigned_index integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.lead_distribution_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.lead_distribution_config (enabled, last_assigned_index) VALUES (false, 0);

-- 4.5 PARTICIPANTES DA DISTRIBUIÇÃO
CREATE TABLE public.lead_distribution (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.lead_distribution ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 5. FUNÇÕES E TRIGGERS
-- ==============================================================================

-- 5.1 Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_leads_updated
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5.2 Sincronizar Novo Usuário (Auth -> Public.Users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user' -- Todo novo user começa como 'user', Admin muda manualmente depois
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no Auth (você precisará rodar isso com permissão de superuser/dashboard)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 5.3 Helper para tem_role (RLS)
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, requested_role public.app_role)
RETURNS boolean AS $$
DECLARE
  user_role public.app_role;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = user_id;
  
  IF user_role = 'admin' THEN
    RETURN true; -- Admin tem acesso a tudo
  END IF;
  
  RETURN user_role = requested_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 6. POLÍTICAS DE SEGURANÇA (RLS)
-- ==============================================================================

-- 6.1 Users
CREATE POLICY "Users view own profile" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage users" ON public.users FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 6.2 Leads
CREATE POLICY "Users view assigned leads" ON public.leads FOR SELECT TO authenticated USING (assigned_to = auth.uid() OR assigned_to IS NULL OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin view all leads" ON public.leads FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users update assigned leads" ON public.leads FOR UPDATE TO authenticated USING (assigned_to = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 6.3 Messages
CREATE POLICY "Users read messages of leads they see" ON public.messages FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.leads WHERE id = messages.lead_id AND (assigned_to = auth.uid() OR assigned_to IS NULL OR has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Users insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service Role Full Access" ON public.messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6.4 Distribution Config
CREATE POLICY "Admin manage config" ON public.lead_distribution_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read config" ON public.lead_distribution_config FOR SELECT TO authenticated USING (true);


-- ==============================================================================
-- 7. REALTIME
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- FIM DO SCRIPT
