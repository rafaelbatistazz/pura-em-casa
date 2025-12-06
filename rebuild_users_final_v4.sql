-- ==============================================================================
-- SCRIPT DE RECONSTRUÇÃO FINAL (V4 - DEFINITIVO)
-- OBJETIVO: Restaurar sistema de usuários mantendo integridade dos dados existentes.
-- ==============================================================================

-- 1. CRIAÇÃO DA TABELA USERS
-- (Recriamos pois foi apagada anteriormente, mas mantemos compatibilidade com Leads/Config)
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

-- 2. FUNÇÃO HELPER: IS_ADMIN()
-- Centraliza a verificação de permissão
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RESTAURAR RELAÇÕES (FOREIGN KEYS)
-- Reconecta as tabelas leads e shortcuts à nova tabela users.

-- LEADS: Reconectar assigned_to
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    ALTER TABLE public.leads 
    ADD CONSTRAINT leads_assigned_to_fkey 
    FOREIGN KEY (assigned_to) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;
END $$;

-- MESSAGE SHORTCUTS: Reconectar created_by
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

-- LEAD DISTRIBUTION: Resetar e reconectar
-- Essa tabela não faz sentido com usuários antigos inexistentes, então limpamos.
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_distribution') THEN
        DELETE FROM public.lead_distribution; 
        
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

-- 4. POLÍTICAS DE SEGURANÇA (RLS) - SIMPLES E EFICAZES

-- Limpar policies antigas para evitar conflitos
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;


-- === USERS ===
-- Admin: Acesso total (Ver, Editar, Excluir)
CREATE POLICY "Users: Admin Full Access" ON public.users FOR ALL USING (public.is_admin());
-- User: Ver a si mesmo (para login/perfil)
CREATE POLICY "Users: View Self" ON public.users FOR SELECT USING (auth.uid() = id);
-- User: Atualizar APENAS nome (usando trigger de segurança se necessário, mas aqui confiamos na query simples)
CREATE POLICY "Users: Update Self" ON public.users FOR UPDATE USING (auth.uid() = id);


-- === LEADS ===
-- Admin: Acesso total
CREATE POLICY "Leads: Admin Full Access" ON public.leads FOR ALL USING (public.is_admin());
-- User: Ver apenas leads atribuídos a si
CREATE POLICY "Leads: View Assigned" ON public.leads FOR SELECT USING (assigned_to = auth.uid());
-- User: Editar apenas leads atribuídos a si (atualizar status, kanban, etc)
CREATE POLICY "Leads: update Assigned" ON public.leads FOR UPDATE USING (assigned_to = auth.uid());


-- === MESSAGES ===
-- Admin: Ver tudo
CREATE POLICY "Messages: Admin Full Access" ON public.messages FOR ALL USING (public.is_admin());
-- User: Ver se tem acesso ao Lead correspondente
CREATE POLICY "Messages: View Assigned" ON public.messages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = messages.lead_id 
    AND (leads.assigned_to = auth.uid())
  )
);

-- === CONFIG & DISTRIBUTION ===
-- Padrão: Admin gerencia, usuários leem (se necessário)
CREATE POLICY "Config: Admin Manage" ON public.system_config FOR ALL USING (public.is_admin());
CREATE POLICY "Config: Public Read" ON public.system_config FOR SELECT USING (true);

-- 5. TRIGGER DE AUTO-ADMIN
-- Lógica: Se a tabela users estiver vazia, o próximo cadastro vira Admin.
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

-- Reativar trigger no Auth
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
