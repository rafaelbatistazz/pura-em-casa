-- ==============================================================================
-- MIGRAÇÃO FINAL V5 (FULL) - "LIMPEZA E RECUPERAÇÃO"
-- ==============================================================================
-- O QUE ESSE SCRIPT FAZ:
-- 1. APAGA a tabela antiga `users` (A "antiga" que estava bugada).
-- 2. CRIA a tabela nova `app_profiles` (Limpa e rápida).
-- 3. SINCRONIZA: Pega todos os logins do `auth.users` e cria os perfis novos.
-- 4. RESTAURA ADMIN: Define você como Admin.
-- 5. CONECTA TUDO: Ajusta Leads, Mensagens, etc para usar a tabela nova.
-- ==============================================================================

BEGIN;

-- 1. DERRUBAR A VELHA GUARDA E LIMPAR TUDO
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.app_profiles CASCADE; -- Garante que não dê erro de duplicação
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- 2. NASCE O NOVO SISTEMA (APP_PROFILES)
CREATE TABLE public.app_profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role text DEFAULT 'user' NOT NULL CHECK (role IN ('admin', 'user')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- RLS (SEGURANÇA TRANSPARENTE)
ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles: Public Read" ON public.app_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Profiles: Admin Write" ON public.app_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Profiles: Update Self" ON public.app_profiles
  FOR UPDATE USING (auth.uid() = id);

-- 3. O GRANDE RESGATE (SYNC)
-- Trazemos de volta todo mundo que tem login no Auth, mas jogamos na tabela nova.
INSERT INTO public.app_profiles (id, email, name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'name', email),
  'user' -- Começa como user
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. RESTAURAR SEU ADMIN AGORA
UPDATE public.app_profiles
SET role = 'admin'
WHERE email ILIKE '%gt.rafaa@gmail.com%';

-- 5. CONECTAR AS PONTAS SOLTAS (FKs)
-- Leads
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
ALTER TABLE public.leads 
  ADD CONSTRAINT leads_assigned_to_fkey 
  FOREIGN KEY (assigned_to) REFERENCES public.app_profiles(id) 
  ON DELETE SET NULL;

-- Shortcuts
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'message_shortcuts') THEN
        ALTER TABLE public.message_shortcuts DROP CONSTRAINT IF EXISTS message_shortcuts_created_by_fkey;
        ALTER TABLE public.message_shortcuts 
        ADD CONSTRAINT message_shortcuts_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES public.app_profiles(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Distribution (Reset para evitar erros)
TRUNCATE public.lead_distribution;
ALTER TABLE public.lead_distribution DROP CONSTRAINT IF EXISTS lead_distribution_user_id_fkey;
ALTER TABLE public.lead_distribution 
  ADD CONSTRAINT lead_distribution_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.app_profiles(id) 
  ON DELETE CASCADE;

-- System Config Permissions
DROP POLICY IF EXISTS "Config: Admin Manage" ON public.system_config;
CREATE POLICY "Config: Admin Manage" ON public.system_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. TRIGGER PARA O FUTURO (Novos cadastros)
CREATE OR REPLACE FUNCTION public.handle_new_app_profile()
RETURNS TRIGGER AS $$
DECLARE
  count_profiles integer;
BEGIN
  SELECT count(*) INTO count_profiles FROM public.app_profiles;
  
  INSERT INTO public.app_profiles (id, email, name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    CASE WHEN count_profiles = 0 THEN 'admin' ELSE 'user' END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_app_profile();

-- Permissões Finais
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;

-- FIM! SISTEMA NOVO E CONECTADO.
