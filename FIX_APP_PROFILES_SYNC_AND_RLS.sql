-- ==============================================================================
-- CORREÇÃO DEFINITIVA: SINCRONIZAÇÃO E PERMISSÕES (APP_PROFILES)
-- ==============================================================================
-- Este script:
-- 1. Garante que todos usuários do Auth existam na tabela app_profiles
-- 2. Reseta as permissões (RLS) para garantir que Admins vejam tudo
-- 3. Garante que seu usuário seja Admin
-- ==============================================================================

-- 1. SINCRONIZAÇÃO (Auth -> App Profiles)
INSERT INTO public.app_profiles (id, email, name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'name', email),
  'user' -- Insere como user por padrão se não existir
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email, -- Atualiza email se mudou
  updated_at = now();

-- 2. GARANTIR SEU ADMIN (Substitua se necessário, padrão gt.rafaa@gmail.com)
UPDATE public.app_profiles
SET role = 'admin'
WHERE email ILIKE '%gt.rafaa@gmail.com%';

-- 3. RESETAR E CORRIGIR RLS (Row Level Security)
ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Profiles: Read All" ON public.app_profiles;
DROP POLICY IF EXISTS "Profiles: Admin Write" ON public.app_profiles;
DROP POLICY IF EXISTS "Profiles: Update Self" ON public.app_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.app_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.app_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.app_profiles;

-- CRIAR NOVAS POLÍTICAS LIMPAS

-- A) LEITURA: Admin vê todos, Usuário vê todos (para poder listar/atribuir)
-- Se quiser restringir usuários de verem outros, mude o USING para (auth.uid() = id OR role = 'admin')
-- Mas para um CRM onde usuários transferem leads, ver todos é útil.
CREATE POLICY "Profiles: Read All" ON public.app_profiles
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- B) INSERT: Geralmente via Trigger, mas Admin pode criar manualmente direto
CREATE POLICY "Profiles: Admin Insert" ON public.app_profiles
  FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    auth.uid() = id -- Auto-insert via trigger/client inicial
  );

-- C) UPDATE: Admin edita qualquer um, Usuário edita apenas a si mesmo
CREATE POLICY "Profiles: Admin Update All" ON public.app_profiles
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Profiles: Self Update" ON public.app_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- D) DELETE: Apenas Admin
CREATE POLICY "Profiles: Admin Delete" ON public.app_profiles
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. VERIFICAÇÃO RAPIDA
SELECT count(*) as total_usuarios FROM public.app_profiles;
SELECT email, role FROM public.app_profiles ORDER BY created_at DESC LIMIT 5;
