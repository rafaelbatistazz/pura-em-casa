-- ==============================================================================
-- RESET SIMPLIFIED V5 - A SOLUÇÃO "SEM FIRULAS"
-- ==============================================================================
-- ATENÇÃO: ISSO APAGA TODOS OS DADOS DE USUÁRIOS E RECONFIGURA O SISTEMA.
-- ==============================================================================

-- 1. LIMPEZA TOTAL (RESET)
-- Drop cascade para garantir que não sobre nada velho.
DROP TABLE IF EXISTS public.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- 2. RECRIAÇÃO DA ESTRUTURA
CREATE TABLE public.users (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'user')), -- Simples Texto com Check (menos dor de cabeça que Enum)
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Habilitar RLS (Segurança básica)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. FUNÇÃO AUXILIAR: IS_ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Verifica se o usuário atual tem role 'admin'
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. POLÍTICAS DE ACESSO (O PULO DO GATO)
-- Simples e direto.

-- LEITURA: TODO MUNDO VÊ TODO MUNDO (Resolve o "não aparece na lista")
CREATE POLICY "Users: Read All" ON public.users 
FOR SELECT USING (auth.role() = 'authenticated');

-- ESCRITA: SÓ ADMIN FAZ TUDO
CREATE POLICY "Users: Admin Full Control" ON public.users 
FOR ALL USING (public.is_admin());

-- AUTO-EDIÇÃO: O USUÁRIO PODE EDITAR SEU PRÓPRIO PERFIL
-- (Inclusive se promover, se souber usar API. Prioridade aqui é FUNCIONAR sem travar).
CREATE POLICY "Users: Update Self" ON public.users 
FOR UPDATE USING (auth.uid() = id);

-- 5. TRIGGER: PRIMEIRO USUÁRIO É O REI (ADMIN)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  users_count integer;
BEGIN
  SELECT count(*) INTO users_count FROM public.users;
  
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    CASE WHEN users_count = 0 THEN 'admin' ELSE 'user' END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reativar trigger no Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 6. RESTAURAR RELAÇÕES (FKS) QUE FORAM DERRUBADAS PELO CASCADE
-- Leads
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
ALTER TABLE public.leads 
ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

-- Messages / Shortcuts (se existirem)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'message_shortcuts') THEN
        ALTER TABLE public.message_shortcuts DROP CONSTRAINT IF EXISTS message_shortcuts_created_by_fkey;
        ALTER TABLE public.message_shortcuts 
        ADD CONSTRAINT message_shortcuts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Lead Distribution (Resetar pois IDs mudaram)
TRUNCATE public.lead_distribution;
ALTER TABLE public.lead_distribution DROP CONSTRAINT IF EXISTS lead_distribution_user_id_fkey;
ALTER TABLE public.lead_distribution 
ADD CONSTRAINT lead_distribution_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- 7. REGRAS DE VISIBILIDADE DE OUTRAS TABELAS (LEADS/MESSAGES)
-- Admin vê tudo. User vê o seu.

-- LEADS
DROP POLICY IF EXISTS "Leads: Admin Full" ON public.leads;
DROP POLICY IF EXISTS "Leads: Check Assigned" ON public.leads;

CREATE POLICY "Leads: Admin Full" ON public.leads FOR ALL USING (public.is_admin());
CREATE POLICY "Leads: Check Assigned" ON public.leads FOR ALL USING (assigned_to = auth.uid());

-- PERMISSÕES BÁSICAS
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- FIM
