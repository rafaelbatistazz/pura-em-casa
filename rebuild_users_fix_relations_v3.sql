-- ==============================================================================
-- SCRIPT DE RECONSTRUÇÃO CIRÚRGICA (V3 - CORREÇÃO DE ERRO)
-- OBJETIVO: Criar tabela USERS e reconectar com LEADS/CONFIG existentes.
-- NÃO APAGA DADOS DE LEADS, MENSAGENS OU CONFIGURAÇÕES.
-- ==============================================================================

-- 1. CRIAÇÃO DA TABELA USERS (Essa foi deletada, então recriamos)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role public.app_role DEFAULT 'user'::public.app_role,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÕES AUXILIARES (Necessárias para RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECONECTAR CHAVES ESTRANGEIRAS (FKS)
-- Como as tabelas leads/shortcuts já existem, apenas adicionamos a constraint de volta

-- LEADS
DO $$
BEGIN
    -- Tenta dropar a constraint antiga se existir (para garantir)
    BEGIN
        ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Adiciona a nova constraint apontando para a nova tabela users
    ALTER TABLE public.leads 
    ADD CONSTRAINT leads_assigned_to_fkey 
    FOREIGN KEY (assigned_to) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;
END $$;

-- MESSAGE SHORTCUTS
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.message_shortcuts DROP CONSTRAINT IF EXISTS message_shortcuts_created_by_fkey;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    ALTER TABLE public.message_shortcuts 
    ADD CONSTRAINT message_shortcuts_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;
END $$;

-- LEAD DISTRIBUTION (Essa tabela costuma ser dependente total, vamos garantir)
-- Se ela existir, limpamos e recriamos a FK.
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_distribution') THEN
        DELETE FROM public.lead_distribution; -- Limpa pois os users mudaram
        
        BEGIN
            ALTER TABLE public.lead_distribution DROP CONSTRAINT IF EXISTS lead_distribution_user_id_fkey;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        ALTER TABLE public.lead_distribution 
        ADD CONSTRAINT lead_distribution_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES public.users(id) 
        ON DELETE CASCADE;
    END IF;
END $$;


-- 4. REAPLICAR POLÍTICAS RLS (Garantir que funcionam com a nova função is_admin)

-- Drop policies antigas para evitar conflitos de nome
DROP POLICY IF EXISTS "Users: Admin full access" ON public.users;
DROP POLICY IF EXISTS "Leitura permitida para autenticados" ON public.users;
DROP POLICY IF EXISTS "Users view self" ON public.users;

DROP POLICY IF EXISTS "Leads: Admin full access" ON public.leads;
DROP POLICY IF EXISTS "Leads: User view assigned" ON public.leads;

DROP POLICY IF EXISTS "Messages: Access via Lead" ON public.messages;

DROP POLICY IF EXISTS "Config: Admin manage" ON public.system_config;
DROP POLICY IF EXISTS "Config: Public read" ON public.system_config;


-- CRIAR POLÍTICAS NOVAS

-- USERS
CREATE POLICY "Users: Admin full access" ON public.users FOR ALL USING (public.is_admin());
CREATE POLICY "Users: Self view/edit" ON public.users FOR ALL USING (auth.uid() = id);

-- LEADS
CREATE POLICY "Leads: Admin full access" ON public.leads FOR ALL USING (public.is_admin());
CREATE POLICY "Leads: User view assigned" ON public.leads FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "Leads: User edit assigned" ON public.leads FOR UPDATE USING (assigned_to = auth.uid());

-- MESSAGES
-- (Assumindo que tabela messages existe e tem lead_id)
CREATE POLICY "Messages: Access via Lead" ON public.messages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = messages.lead_id 
    AND (leads.assigned_to = auth.uid() OR public.is_admin())
  )
);

-- SYSTEM CONFIG
CREATE POLICY "Config: Admin manage" ON public.system_config FOR ALL USING (public.is_admin());
CREATE POLICY "Config: Public read" ON public.system_config FOR SELECT USING (true);


-- 5. TRIGGER DE NOVO USUÁRIO (BOOTSTRAP ADMIN)
-- O primeiro usuário criado SERÁ ADMIN.
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

-- Trigger na auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 6. GRANT PERMISSIONS
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- FIM
