-- ==============================================================================
-- SETUP EVOLUTION API & N8N TABLES (V13)
-- ==============================================================================

-- 1. Tabela de Instâncias (Para gerenciar a conexão com Whatsapp)
CREATE TABLE IF NOT EXISTS public.instances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    server_url text NOT NULL,
    api_key text NOT NULL,
    status text DEFAULT 'disconnected', -- connected, disconnected, connecting
    qrcode_base64 text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RLS para Instances
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin Manage Instances" ON public.instances FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Read Instances" ON public.instances FOR SELECT TO authenticated USING (true); -- Usuários precisam ver status

-- 2. Tabela de Integração N8N (Dados do Cliente/Lead)
CREATE TABLE IF NOT EXISTS public.n8n_dados_cliente (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    nome text,
    telefone text,
    email text,
    status_envio text DEFAULT 'pendente', -- pendente, enviado, erro
    n8n_webhook_response jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS para N8N
ALTER TABLE public.n8n_dados_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "N8N Access" ON public.n8n_dados_cliente FOR ALL TO authenticated USING (true);

-- 3. Atualizar System Config com credenciais globais da Evolution (se não existirem)
INSERT INTO public.system_config (key, value, description)
VALUES 
    ('evolution_api_url', '', 'URL da API Evolution'),
    ('evolution_api_key', '', 'Global API Key da Evolution'),
    ('evolution_instance_global', 'LeadWhisper', 'Nome da instância padrão')
ON CONFLICT (key) DO NOTHING;
