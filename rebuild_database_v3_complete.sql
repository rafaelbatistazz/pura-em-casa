-- ==============================================================================
-- SCRIPT DE RECONSTRUÇÃO TOTAL DO BANCO DE DADOS (V3 - FINAL)
-- OBJETIVO: Corrigir Timezone, Criar todas as tabelas (App + N8N) e Configurar Storage
-- DATA: 2025-12-05
-- ==============================================================================

-- 1. CONFIGURAÇÃO DE FUSO HORÁRIO (CRÍTICO)
ALTER DATABASE postgres SET timezone TO 'America/Sao_Paulo';
ALTER ROLE authenticated SET timezone TO 'America/Sao_Paulo';
ALTER ROLE service_role SET timezone TO 'America/Sao_Paulo';
ALTER ROLE postgres SET timezone TO 'America/Sao_Paulo';

-- 2. LIMPEZA TOTAL (CUIDADO: APAGA DADOS)
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
-- 4. TABELAS DO SISTEMA
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

-- 4.2 LEADS (CRM)
CREATE TABLE public.leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  name text,
  status text DEFAULT 'novo', -- 'novo', 'em_atendimento', 'aguardando', 'ganho', 'perdido'
  assigned_to uuid REFERENCES public.users(id),
  kanban_position integer DEFAULT 0,
  notes text,
  unread_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 4.3 MESSAGES (Chat)
CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  message_text text,
  media_url text,
  media_type text DEFAULT 'text', -- 'text', 'image', 'audio', 'video', 'document'
  read boolean DEFAULT false,
  sender_name text,
  phone text, -- Redundante para facilitar queries
  timestamp timestamp with time zone DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4.4 SYSTEM CONFIG (Configurações Globais / Evolution API)
CREATE TABLE public.system_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 4.5 MESSAGE SHORTCUTS (Respostas Rápidas)
CREATE TABLE public.message_shortcuts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger text NOT NULL UNIQUE,
  content text NOT NULL,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.message_shortcuts ENABLE ROW LEVEL SECURITY;

-- 4.6 LEAD DISTRIBUTION (Configuração Round-Robin)
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
  is_active boolean DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.lead_distribution ENABLE ROW LEVEL SECURITY;

-- 4.7 USER ROLES (Tabela Redundante para Compatibilidade)
CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role DEFAULT 'user'::public.app_role
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4.8 INSTANCES (Compatibilidade Legacy)
CREATE TABLE public.instances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name text,
  api_url text,
  api_key text,
  qr_code text,
  status text,
  last_connected timestamp with time zone
);
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 5. TABELAS DE INTEGRAÇÃO (N8N)
-- ==============================================================================

CREATE TABLE public.n8n_dados_cliente (
  id SERIAL PRIMARY KEY,
  nome text,
  telefone text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.n8n_dados_cliente ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.n8n_fila_mensagens (
  id SERIAL PRIMARY KEY,
  id_mensagem text,
  mensagem text,
  telefone text,
  timestamp timestamp with time zone DEFAULT now()
);
ALTER TABLE public.n8n_fila_mensagens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.n8n_historico_mensagens (
  id SERIAL PRIMARY KEY,
  session_id text,
  message jsonb,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.n8n_historico_mensagens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.n8n_status_atendimento (
  id SERIAL PRIMARY KEY,
  session_id text,
  numero_followup integer DEFAULT 0,
  aguardando_followup boolean DEFAULT false,
  lock_conversa boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.n8n_status_atendimento ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 6. STORAGE (BUCKETS)
-- ==============================================================================
-- Criação do Bucket 'chat-media' para áudios e imagens
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-media', 'chat-media', true, 52428800, '{image/*, audio/*, video/*, application/pdf}')
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'chat-media');
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media');
CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'chat-media');
CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-media');

-- ==============================================================================
-- 7. FUNÇÕES E TRIGGERS
-- ==============================================================================

-- 7.1 Helper: Has Role
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, requested_role public.app_role)
RETURNS boolean AS $$
DECLARE
  user_role public.app_role;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = user_id;
  IF user_role = 'admin' THEN RETURN true; END IF;
  RETURN user_role = requested_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 Trigger: Updated At
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_users_updated BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_config_updated BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7.3 Trigger: New User Sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'user');
  
  -- Sync redundante para user_roles
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- OBS: O Trigger na auth.users deve ser criado manualmente no dashboard se não tiver permissão aqui
-- mas tentamos definir:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7.4 Função: Formatar Telefone
CREATE OR REPLACE FUNCTION public.format_brazilian_phone(p_phone text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_phone text;
  v_ddd text;
  v_number text;
BEGIN
  v_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF NOT v_phone LIKE '55%' THEN v_phone := '55' || v_phone; END IF;
  v_ddd := substring(v_phone from 3 for 2);
  v_number := substring(v_phone from 5);
  IF length(v_number) = 8 AND v_number ~ '^[6-9]' THEN v_number := '9' || v_number; END IF;
  RETURN '55' || v_ddd || v_number;
END;
$$;

-- 7.5 Função: Distribuição de Leads
CREATE OR REPLACE FUNCTION public.get_next_assigned_user()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_config RECORD;
  v_next_user_id uuid;
  v_user_count integer;
  v_next_index integer;
BEGIN
  SELECT * INTO v_config FROM lead_distribution_config LIMIT 1;
  IF v_config IS NULL OR NOT v_config.enabled THEN RETURN NULL; END IF;
  
  SELECT COUNT(*) INTO v_user_count FROM lead_distribution WHERE is_active = true;
  IF v_user_count = 0 THEN RETURN NULL; END IF;
  
  v_next_index := (COALESCE(v_config.last_assigned_index, 0) % v_user_count) + 1;
  
  SELECT user_id INTO v_next_user_id FROM lead_distribution 
  WHERE is_active = true ORDER BY position, created_at OFFSET (v_next_index - 1) LIMIT 1;
  
  IF v_next_user_id IS NOT NULL THEN
    UPDATE lead_distribution_config SET last_assigned_index = v_next_index, updated_at = now();
  END IF;
  
  RETURN v_next_user_id;
END;
$$;

-- 7.6 Função: Webhook Upsert
CREATE OR REPLACE FUNCTION public.upsert_lead_from_webhook(p_phone text, p_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lead_id uuid;
  v_formatted_phone text;
  v_assigned_user uuid;
BEGIN
  v_formatted_phone := format_brazilian_phone(p_phone);
  SELECT id INTO v_lead_id FROM leads WHERE phone = v_formatted_phone;
  
  IF v_lead_id IS NULL THEN
    v_assigned_user := get_next_assigned_user();
    INSERT INTO leads (phone, name, status, assigned_to)
    VALUES (v_formatted_phone, COALESCE(p_name, v_formatted_phone), 'novo', v_assigned_user)
    RETURNING id INTO v_lead_id;
  ELSE
    UPDATE leads SET updated_at = now() WHERE id = v_lead_id;
  END IF;
  RETURN v_lead_id;
END;
$$;

-- ==============================================================================
-- 8. POLÍTICAS DE SEGURANÇA (RLS)
-- ==============================================================================

-- USERS
CREATE POLICY "Users view self" ON public.users FOR SELECT USING (auth.uid() = id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access users" ON public.users FOR ALL USING (has_role(auth.uid(), 'admin'));

-- LEADS
CREATE POLICY "View leads" ON public.leads FOR SELECT USING (assigned_to = auth.uid() OR assigned_to IS NULL OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Update leads" ON public.leads FOR UPDATE USING (assigned_to = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Delete leads" ON public.leads FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- MESSAGES
CREATE POLICY "View messages" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.leads WHERE id = messages.lead_id AND (assigned_to = auth.uid() OR assigned_to IS NULL OR has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Insert messages" ON public.messages FOR INSERT WITH CHECK (true);

-- SYSTEM CONFIG (Somente leitura para user, Full para admin)
CREATE POLICY "View config" ON public.system_config FOR SELECT USING (true);
CREATE POLICY "Manage config" ON public.system_config FOR ALL USING (has_role(auth.uid(), 'admin'));

-- MESSAGE SHORTCUTS
CREATE POLICY "View shortcuts" ON public.message_shortcuts FOR SELECT USING (true);
CREATE POLICY "Manage shortcuts" ON public.message_shortcuts FOR ALL USING (true);

-- DISTRIBUTION
CREATE POLICY "View dist" ON public.lead_distribution FOR SELECT USING (true);
CREATE POLICY "Manage dist" ON public.lead_distribution FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "View dist config" ON public.lead_distribution_config FOR SELECT USING (true);
CREATE POLICY "Manage dist config" ON public.lead_distribution_config FOR ALL USING (has_role(auth.uid(), 'admin'));

-- N8N TABLES (Acesso livre para testes/integração via Auth Service Role, leitura para auth users se necessário)
CREATE POLICY "N8N Access" ON public.n8n_dados_cliente FOR ALL USING (true);
CREATE POLICY "N8N Access Msg" ON public.n8n_fila_mensagens FOR ALL USING (true);
CREATE POLICY "N8N Access Hist" ON public.n8n_historico_mensagens FOR ALL USING (true);
CREATE POLICY "N8N Access Stats" ON public.n8n_status_atendimento FOR ALL USING (true);

-- USER ROLES (Redundante)
CREATE POLICY "View roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'));

-- INSTANCES
CREATE POLICY "View instances" ON public.instances FOR SELECT USING (true);
CREATE POLICY "Manage instances" ON public.instances FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ==============================================================================
-- 9. REALTIME
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- FIM
